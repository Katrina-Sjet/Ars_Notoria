/**
 * @file GameEngine.js
 * @description 게임 전체 상태 관리 및 규칙 제어용 중앙 관제 엔진 클래스
 */
import { GamePhase } from './GamePhase.js';
import { Player } from './Player.js';

export class GameEngine {
    constructor() {
        this.state = {
            scriptName: "",
            currentPhase: GamePhase.SETUP,
            dayCount: 1,
            players: [], 
            history: [], 
            
            stats: {
                totalRegularPlayers: 0, 
                totalTravelers: 0,      
                aliveRegularCount: 0,   
                aliveTravelerCount: 0,  
                totalAvailableVotes: 0, 
                votesNeeded: 0          
            },

            timer: {
                isRunning: false,
                endTime: null 
            },

            nomination: {
                nominatorsToday: [], 
                nomineesToday: [],   
                onTheBlockId: null,  
                highestVotes: 0,     
                isTie: false,
                blockNominatorId: null,
                blockVoters: []         
            }
        };
    }

    getPlayerById(id) { 
        return this.state.players.find(p => p.id === id); 
    }

    recalculateStats() {
        const regularPlayers = this.state.players.filter(p => p.character && p.character.team !== 5);
        const travelers = this.state.players.filter(p => p.character && p.character.team === 5);

        const aliveRegulars = regularPlayers.filter(p => p.isAlive);
        const aliveTravelers = travelers.filter(p => p.isAlive);
        const deadWithVote = this.state.players.filter(p => !p.isAlive && p.hasGhostVote);

        this.state.stats.totalRegularPlayers = regularPlayers.length;
        this.state.stats.totalTravelers = travelers.length;
        this.state.stats.aliveRegularCount = aliveRegulars.length;
        this.state.stats.aliveTravelerCount = aliveTravelers.length;
        this.state.stats.totalAvailableVotes = aliveRegulars.length + aliveTravelers.length + deadWithVote.length;
        
        this.state.stats.votesNeeded = Math.ceil((aliveRegulars.length + aliveTravelers.length) / 2);
    }

    logEvent(eventPayload) {
        const finalizedLog = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            day: this.state.dayCount,
            phase: this.state.currentPhase,
            ...eventPayload
        };
        this.state.history.push(finalizedLog);
    }

    buildNightQueue() {
        const queue = [];
        const isFirstNight = this.state.currentPhase === GamePhase.FIRST_NIGHT;

        this.state.players.forEach(player => {
            if (!player.character) return;
            const order = isFirstNight ? player.character.firstNight : player.character.otherNight;
            if (order > 0) {
                queue.push({
                    playerId: player.id,
                    characterId: player.character.id,
                    order: order,
                    isAlive: player.isAlive
                });
            }
        });

        queue.sort((a, b) => a.order - b.order);
        return queue;
    }

    // ------------------------------------------------------------------------
    // [야간 페이즈 큐 비동기 제어 파이프라인 (Night Action Controller)]
    // ------------------------------------------------------------------------

    /**
     * 야간 큐를 비동기적으로 순회하며 캐릭터들의 기상 및 능력 실행을 제어합니다.
     * @param {Function} requestUIInputCallback - ST에게 UI 입력을 요청하고 Promise를 반환하는 프론트엔드 콜백 함수
     * @returns {Promise<boolean>} 야간 행동 전체 종료 여부
     */
    async runNightPhase(requestUIInputCallback) {
        const queue = this.buildNightQueue();

        for (const queueItem of queue) {
            const player = this.getPlayerById(queueItem.playerId);
            if (!player || !player.character || !player.character.LogicClass) continue;

            const LogicClass = player.character.LogicClass;

            // 1. 기상 조건 평가 (명세 4.1: 동적 판단 위임)
            const shouldWake = LogicClass.checkWakeCondition(player, this.state);
            if (!shouldWake) continue; // 깨어나지 않는 경우 스킵

            // 2. 행동을 위한 UI 스키마 요청
            const uiSchema = LogicClass.onRequest(this, player, this.state.currentPhase);
            let inputData = { skipped: false };
            
            // 3. ST의 입력 대기 (UI 스키마가 존재하고 입력 불필요 상태가 아닐 경우)
            if (uiSchema && uiSchema.type !== 'NONE') {
                try {
                    // 프론트엔드의 모달이 닫힐 때까지 파이프라인 일시 정지 (논블로킹 대기)
                    inputData = await requestUIInputCallback(player, uiSchema);
                } catch (error) {
                    console.error(`[Night Phase] ${player.name} 입력 대기 중 오류 발생:`, error);
                    inputData = { skipped: true }; // 오류 또는 ST 강제 취소 시 스킵 처리
                }
            }

            // 4. 입력 데이터 기반 실제 로직 실행 및 상태 변경
            const result = LogicClass.onExecute(this, player, this.state.currentPhase, inputData);

            // 5. 능력 실행 결과 히스토리 자동 로깅
            if (result) this.logEvent(result);
        }
        
        return true; // 야간 행동 모두 종료
    }

    // ------------------------------------------------------------------------
    // [페이즈 및 위상 제어 메서드]
    // ------------------------------------------------------------------------

    setPhase(newPhase) {
        const previousPhase = this.state.currentPhase;
        this.state.currentPhase = newPhase;

        // 리마인더 차감 처리 (새로운 주요 페이즈 진입 시 1회 격발)
        const isTransitionToDay = newPhase === GamePhase.DAY && (previousPhase === GamePhase.NIGHT || previousPhase === GamePhase.FIRST_NIGHT);
        const isTransitionToNight = newPhase === GamePhase.NIGHT && (previousPhase === GamePhase.DAY || previousPhase === GamePhase.NOMINATION);
        
        if (isTransitionToDay || isTransitionToNight) {
            this.state.players.forEach(p => p.tickReminders());
        }

        // 1. 밤으로 넘어갈 때: 낮 동안의 임시 데이터 및 타이머 강제 초기화
        if (newPhase === GamePhase.NIGHT || newPhase === GamePhase.FIRST_NIGHT) {
            this.state.timer.isRunning = false;
            this.state.timer.endTime = null;

            this.state.nomination.nominatorsToday = [];
            this.state.nomination.nomineesToday = [];

            this.state.nomination.onTheBlockId = null;
            this.state.nomination.highestVotes = 0;
            this.state.nomination.isTie = false;
            this.state.nomination.blockNominatorId = null;
            this.state.nomination.blockVoters = [];
        }

        // 2. 밤에서 낮으로 넘어갈 때: 일차(Day Count) 갱신
        if (newPhase === GamePhase.DAY && previousPhase !== GamePhase.SETUP) {
            if (previousPhase === GamePhase.NIGHT) {
                this.state.dayCount++;
            }
        }

        this.logEvent({
            actorId: "system",
            actionType: "PHASE_CHANGE",
            targetIds: [],
            note: `페이즈가 [${newPhase}] 상태로 전환됨.`
        });
    }

    // ------------------------------------------------------------------------
    // [낮 페이즈 투표 및 처형 제어 메서드]
    // ------------------------------------------------------------------------

    toggleGhostVote(playerId, forceState = null) {
        const player = this.getPlayerById(playerId);
        if (!player) return;
        player.hasGhostVote = forceState !== null ? forceState : !player.hasGhostVote;
    }

    toggleNominationStatus(playerId, type) {
        const list = type === 'nominator' ? this.state.nomination.nominatorsToday : this.state.nomination.nomineesToday;
        const index = list.indexOf(playerId);
        if (index > -1) list.splice(index, 1);
        else list.push(playerId);
    }

    updateBlock(nomineeId, voteCount, nominatorId = null, voters = []) {
        const votesNeeded = this.state.stats.votesNeeded; 
        const { nomination } = this.state;

        if (voteCount < votesNeeded) return;

        if (voteCount > nomination.highestVotes) {
            nomination.highestVotes = voteCount;
            nomination.onTheBlockId = nomineeId;
            nomination.isTie = false;
            nomination.blockNominatorId = nominatorId;
            nomination.blockVoters = voters;
        } else if (voteCount === nomination.highestVotes) {
            nomination.isTie = true;
            nomination.onTheBlockId = null; 
            nomination.blockNominatorId = null;
            nomination.blockVoters = [];
        }
    }

    getExecutionCandidates() {
        const { onTheBlockId } = this.state.nomination;
        const candidates = [...this.state.players];

        candidates.sort((a, b) => {
            if (a.id === onTheBlockId) return -1;
            if (b.id === onTheBlockId) return 1;

            const aCanExecute = a.activeReminders.some(r => r.effectType === 'canDayExecute');
            const bCanExecute = b.activeReminders.some(r => r.effectType === 'canDayExecute');
            
            if (aCanExecute && !bCanExecute) return -1;
            if (!aCanExecute && bCanExecute) return 1;

            if (a.isAlive && !b.isAlive) return -1;
            if (!a.isAlive && b.isAlive) return 1;

            return a.seatIndex - b.seatIndex;
        });

        return candidates;
    }

    executePlayer(playerId, isFromBlock = false, causeCharacterId = null, activeNominator = null, activeVoters = []) {
        const target = this.getPlayerById(playerId);
        if (!target || !target.isAlive) return;

        let actionType = "";
        let noteStr = "";
        let logNominator = null;
        let logVoters = [];

        if (isFromBlock) {
            actionType = "VOTE_EXECUTION";
            noteStr = `투표 결과에 따른 정규 처형. (득표수: ${this.state.nomination.highestVotes})`;
            logNominator = this.state.nomination.blockNominatorId;
            logVoters = [...this.state.nomination.blockVoters];
        } else {
            actionType = "SPECIAL_EXECUTION";
            const causeStr = causeCharacterId ? `[${causeCharacterId}]` : "특수";
            noteStr = `${causeStr} 능력 또는 룰에 의한 수동 특수 처형.`;
            
            logNominator = activeNominator;
            logVoters = [...activeVoters];

            if (causeCharacterId !== 'vizier') {
                logVoters = []; 
            }
            if (causeCharacterId !== 'vizier' && causeCharacterId !== 'virgin') {
                logNominator = null; 
            }
        }

        target.kill();
        target.addReminder("처형됨", "system", -1, 'none');

        this.logEvent({
            actorId: "system",
            actionType: actionType,
            targetIds: [playerId],
            nominatorId: logNominator,
            voters: logVoters,
            note: noteStr
        });

        this.state.nomination.onTheBlockId = null;
        this.state.nomination.highestVotes = 0;
        this.state.nomination.isTie = false;
        this.state.nomination.blockNominatorId = null;
        this.state.nomination.blockVoters = [];
    }

    // ------------------------------------------------------------------------
    // [명세 9: 전역 상태 저장 및 복구 파이프라인 (Save & Restore)]
    // ------------------------------------------------------------------------

    exportSnapshot() {
        return JSON.stringify(this.state, (key, value) => {
            // 직렬화 최적화: character 객체는 무거우므로 ID 문자열로 치환하여 저장
            if (key === 'character' && value && value.id) return value.id;
            return value;
        });
    }

    loadSnapshot(snapshotJson, characterDictionary) {
        try {
            const parsed = JSON.parse(snapshotJson);
            this.state = parsed;
            
            // 순수 데이터(POJO)를 Player 인스턴스로 재조립 (Rehydration)
            this.state.players = parsed.players.map(pData => {
                const player = new Player(pData.id, pData.name, pData.position.x, pData.position.y);
                Object.assign(player, pData); // 기존 원시값 상태 복구
                
                // 리마인더 배열 명시적 복구 (참조 분리 및 안전한 배열화 보장)
                player.activeReminders = pData.activeReminders ? [...pData.activeReminders] : [];
                
                if (pData.character) player.assignCharacter(characterDictionary[pData.character]);
                return player;
            });
            return true;
        } catch (e) { console.error("상태 복구 실패:", e); return false; }
    }
}