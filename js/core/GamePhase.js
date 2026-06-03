/**
 * @file GamePhase.js
 * @description 게임의 시간축 위상(Phase)을 정의하는 상수 모음
 */
export const GamePhase = Object.freeze({
    SETUP: 'Setup',           // 초기 세팅
    FIRST_NIGHT: 'FirstNight',// 1일 차 밤
    DAY: 'Day',               // 낮
    NOMINATION: 'Nomination', // 지명 및 투표
    NIGHT: 'Night',           // 2일 차 이후의 밤
    END: 'End'                // 게임 종료
});