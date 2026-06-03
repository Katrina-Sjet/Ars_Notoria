/**
 * @file UIInputTypes.js
 * @description 야간/주간 행동 시 UI 레이어가 렌더링해야 할 입력 컴포넌트 규격
 */
export const UIInputType = Object.freeze({
    PLAYER: 'PLAYER',       // 특정 수의 플레이어 지목 (count 속성 포함)
    CHARACTER: 'CHARACTER', // 특정 수의 캐릭터 지목 (count 속성 포함)
    NUMBER: 'NUMBER',       // 정수 숫자 입력
    TEXT: 'TEXT',           // 자유 텍스트 입력
    CHOICE: 'CHOICE',       // ST 지정 단일/다중 선택 (예/아니오, 선/악, 왼쪽/오른쪽 등 커스텀 옵션 배열)
    REPEATER: 'REPEATER',   // 복합 입력. 하위 스키마(1~5번) 묶음을 동적으로 N회 반복 추가할 수 있는 컨테이너
    NONE: 'NONE'            // 입력 불필요 (순수 패시브 등, 명세 6.1 대응)
});