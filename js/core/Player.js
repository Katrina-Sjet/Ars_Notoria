/**
 * @file Player.js
 * @description 게임 참여 플레이어(토큰)의 실시간 상태 변화 관리 클래스
 */
export class Player {
    constructor(id, name, x = 0.5, y = 0.5) {
        // 기본 정보
        this.id = id;
        this.name = name;
        this.character = null; // Character 인스턴스 (불변 데이터) 참조

        // 명세 2-D: 동적 좌석 번호 및 좌표 
        // (생성 시 할당하지 않고 GrimoireController의 atan2 연산으로 덮어씀)
        this.seatNumber = null; 
        this.position = { x, y }; 

        // 명세 2-B: 생사 및 투표/지목 관련 상태
        this.isAlive = true;
        this.hasGhostVote = true; // 유령 투표권
        this.isNominated = false; // 지목(처형 투표 대상) 여부
        this.isTargeted = false;  // 피지목(야간 행동 등 능력의 대상) 여부

        // 리마인더 배열: { text, sourceId, duration, effectType }
        this.activeReminders = [];
    }

    // 명세 2-B: 파생 상태 (Derived State) 원칙
    // 독립된 Boolean 변수를 배제하고 리마인더를 스캔하여 상태 도출
    get isPoisoned() { return this.activeReminders.some(r => r.effectType === 'poison'); }
    get isDrunk() { return this.activeReminders.some(r => r.effectType === 'drunk'); }
    get isMadness() { return this.activeReminders.some(r => r.effectType === 'madness'); }
    get hasUsedAbility() { return this.activeReminders.some(r => r.effectType === 'used'); }
    get isDisguised() { return this.activeReminders.some(r => r.effectType === 'disguised'); }

    // GameEngine.setPhase()에서 호출되는 리마인더 기간 차감 메서드
    tickReminders() {
        this.activeReminders.forEach(r => {
            if (r.duration > 0) {
                r.duration -= 1;
            }
        });
        // duration이 0이 된 리마인더 필터링 (삭제)
        this.activeReminders = this.activeReminders.filter(r => r.duration !== 0);
    }

    /**
     * 명세 6.3: 동적 태그 평가
     * 공격이나 상태 이상을 받을 때 방어 태그의 유효성을 검증합니다.
     * @param {string} threatType - 위협 타입 (예: "KILL", "POISON")
     * @param {Player} sourcePlayer - 위협을 가하는 주체 플레이어
     * @param {Object} engine - 리마인더 부여 주체 역추적을 위한 엔진 참조
     * @returns {boolean} 방어 성공 여부 (true면 위협 무효화)
     */
    evaluateProtection(threatType, sourcePlayer, engine) {
        // 1. 패시브 방어 검사: 본인이 중독/취함 상태면 고유 방어 능력 상실 (추후 Character 로직 연동)
        if (!this.isPoisoned && !this.isDrunk) {
            // (여기에 본인 캐릭터의 기본 패시브 방어 태그 대조 로직 추가)
        }

        // 2. 리마인더 기반 방어 검사 (타인에 의해 부여된 방어 역추적)
        const protectionReminders = this.activeReminders.filter(r => r.effectType === 'PROTECT' && (r.against === threatType || r.against === 'ALL'));
        
        for (const reminder of protectionReminders) {
            const protector = engine.getPlayerById(reminder.sourceId);
            if (protector && !protector.isPoisoned && !protector.isDrunk) return true;
        }
        return false;
    }

    // 참조 포인터 변경 (역할 변경 시 사용)
    assignCharacter(characterInstance) { 
        this.character = characterInstance; 
    }
    
    kill() { 
        if (!this.isAlive) return; 
        this.isAlive = false; 
        this.hasGhostVote = true; 
    }
    
    revive() { 
        if (this.isAlive) return; 
        this.isAlive = true; 
        this.hasGhostVote = false; 
    }
    
    useGhostVote() {
        if (!this.isAlive && this.hasGhostVote) { 
            this.hasGhostVote = false; 
            return true; 
        }
        return false;
    }

    updatePosition(ratioX, ratioY) { 
        this.position.x = ratioX; 
        this.position.y = ratioY; 
    }

    addReminder(text, sourceId, duration = -1, effectType = 'none') {
        const existingIndex = this.activeReminders.findIndex(r => r.text === text && r.sourceId === sourceId);
        if (existingIndex !== -1) {
            this.activeReminders[existingIndex].duration = duration;
            this.activeReminders[existingIndex].effectType = effectType;
        } else {
            this.activeReminders.push({ text, sourceId, duration, effectType });
        }
    }

    removeReminder(text, sourceId) {
        this.activeReminders = this.activeReminders.filter(r => !(r.text === text && r.sourceId === sourceId));
    }
    
    clearReminders() { 
        this.activeReminders = []; 
    }
}