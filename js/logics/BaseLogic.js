/**
 * @file logics/BaseLogic.js
 * @description 모든 캐릭터 로직의 공통 행위를 정의하는 부모 클래스
 */
import { UIInputType } from '../core/UIInputTypes.js';

export class BaseLogic {
    // [기존 유지] 낮 행동 가능 여부 (기본값: false)
    static hasDayAbility = false;

    // [기존 유지] 이 캐릭터가 발급할 수 있는 전용 리마인더 목록 (자식 클래스에서 오버라이드)
    static reminders = [];

    // --- [신규 추가: 명세 2번 데이터 캡슐화 및 셋업 속성] ---
    
    // 1. 물리적 배분 제외 속성 (예: 릴몬스타)
    static excludeFromBag = false; 
    
    // 2. 명시적 위장 지정 속성 (예: 주정뱅이, 꼭두각시 등)
    static disguisedAs = null;     

    // 3. 캐릭터가 선택 풀에 포함되었을 때 반환하는 셋업 변동치 배열
    static setupModifier() {
        return null;
    }

    // 4. 캐릭터가 선택 풀에 포함되지 않았을 때 반환하는 셋업 변동치 배열 (예: 둔세자, 보초)
    static unselectedModifier() {
        return null;
    }

    // 5. CSV가 아닌 내부 JS에서 하드코딩으로 처리하는 징크스 논리
    static applyJinxLogic(engine) {
        // 자식 클래스에서 필요 시 오버라이드
    }
    // ---------------------------------------------------

    // --- [신규 추가: 명세 4번 야간 기상 조건 평가] ---
    /**
     * 야간 페이즈에 해당 캐릭터가 기상(Wake)해야 하는지 판단합니다.
     * @param {Player} player - 판단 대상 플레이어 인스턴스
     * @param {Object} engineState - 현재 게임 엔진 상태 (GameEngine.state)
     * @returns {boolean} 기상 여부
     */
    static checkWakeCondition(player, engineState) {
        return player.isAlive; // 기본 규격: 살아있으면 깨어나고, 죽어있으면 깨어나지 않음
    }

    // [기존 유지] 행동 UI 요청 (자식 클래스에서 오버라이드)
    static onRequest(engine, player, phase) {
        return null; 
    }

    // [기존 유지] 실행 및 생략(Skip) 공통 처리 (오버라이드 금지)
    static onExecute(engine, player, phase, inputData) {
        // [공통 방어 로직] 스토리텔러가 능력 사용을 생략했을 경우
        if (inputData.skipped) {
            return {
                actorId: player.id,
                actionType: "SKIPPED",
                note: "능력 사용을 생략함."
            };
        }

        // 실제 능력 발동은 자식 클래스의 메서드로 위임
        return this.executeAbility(engine, player, phase, inputData);
    }

    // [기존 유지] 실제 능력 구현부 (자식 클래스에서 반드시 구현)
    static executeAbility(engine, player, phase, inputData) {
        throw new Error("executeAbility가 구현되지 않았습니다.");
    }
}