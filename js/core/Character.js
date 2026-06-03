/**
 * @file Character.js
 * @description Blood on the Clocktower의 캐릭터 정적 명세, 텍스트 오버라이드 및 JS 로직을 통합하는 클래스
 */

export class BaseCharacter {
    /**
     * @param {Object} officialJson - 공식 커뮤니티 표준 캐릭터 JSON 데이터 (뼈대)
     * @param {Object} csvRow - CSV 데이터로부터 파싱된 ID 매칭 행 (순수 텍스트 오버라이드)
     * @param {Class} LogicClass - BaseLogic을 상속받은 캐릭터별 정적 JS 클래스
     */
    constructor(officialJson, csvRow = {}, LogicClass = null) {
        // 1. 공식 표준 명세(JSON) 기반 뼈대 초기화
        this.id = officialJson.id;
        this.edition = officialJson.edition || "";
        this.name = officialJson.name;
        this.team = this.parseTeam(officialJson.team);
        this.type = officialJson.type || "";
        this.icon = officialJson.image || officialJson.icon; // 명세 통일 (image -> icon)
        
        // JSON 텍스트 기본값 (이후 CSV로 덮어씌워짐)
        this.abilityText = officialJson.ability || "";
        this.firstNightText = officialJson.firstNightReminder || "";
        this.otherNightText = officialJson.otherNightReminder || "";
        this.jinxes = officialJson.jinxes || []; // 텍스트 전용

        // 야간 행동 순서 (JSON/CSV 통제 허용)
        this.firstNight = officialJson.firstNight || 0;
        this.otherNight = officialJson.otherNight || 0;

        // 2. 예외 없는 동적 CSV 텍스트 오버라이드 적용
        this.applyCsvOverride(csvRow);

        // 3. 내부 JS 클래스(LogicClass) 연동 및 캡슐화 데이터 바인딩
        this.LogicClass = LogicClass; // 향후 시스템 엔진이 직접 접근하여 행동 로직을 호출함

        if (LogicClass) {
            this.reminders = LogicClass.reminders || [];
            this.excludeFromBag = LogicClass.excludeFromBag || false;
            this.disguisedAs = LogicClass.disguisedAs || null;
            this.setupModifier = LogicClass.setupModifier || null;
            this.unselectedModifier = LogicClass.unselectedModifier || null;
        } else {
            // LogicClass가 없을 경우의 안전 장치
            this.reminders = [];
            this.excludeFromBag = false;
            this.disguisedAs = null;
            this.setupModifier = null;
            this.unselectedModifier = null;
        }
    }

    /**
     * CSV 데이터를 기반으로 텍스트 속성들을 동적으로 덮어씁니다.
     * (주의: 시스템 연산에 개입하는 리마인더 및 셋업 변수는 CSV로 덮어쓸 수 없습니다.)
     * @param {Object} csvRow - CSV 행 데이터 객체
     */
    applyCsvOverride(csvRow) {
        if (!csvRow || Object.keys(csvRow).length === 0) return;

        for (const key in csvRow) {
            if (csvRow[key] !== undefined && csvRow[key] !== "") {
                
                // [특수 타입 보정 1] 야간 행동 순서 정수형 강제 변환
                if ((key === 'firstNight' || key === 'otherNight') && typeof csvRow[key] === 'string') {
                    this[key] = parseInt(csvRow[key], 10) || 0;
                    continue;
                }

                // [특수 타입 보정 2] 징크스 객체 배열 처리 (텍스트 분리용)
                if (key === 'jinxes' && typeof csvRow[key] === 'string') {
                    const rawValue = csvRow[key].trim();
                    
                    if (rawValue.startsWith('[')) {
                        try {
                            this[key] = JSON.parse(rawValue);
                        } catch (e) {
                            console.error(`[Jinxes JSON 파싱 실패] ID: ${this.id}`, e);
                            this[key] = [];
                        }
                    } else {
                        this[key] = rawValue.split('|').filter(p => p.trim()).map(pair => {
                            const colonIndex = pair.indexOf(':');
                            if (colonIndex === -1) {
                                return { id: pair.trim(), reason: "" };
                            }
                            return {
                                id: pair.substring(0, colonIndex).trim(),
                                reason: pair.substring(colonIndex + 1).trim()
                            };
                        });
                    }
                    continue;
                }

                // [공통 처리] 그 외 일반 문자열 속성 (name, abilityText 등) 1:1 동적 매핑
                this[key] = csvRow[key];
            }
        }
    }

    /**
     * 문자열 진영 데이터를 내부 연산용 정수 식별자로 변환합니다.
     * @param {string|number} teamValue - 진영 데이터
     * @returns {number} 1: 주민, 2: 외지인, 3: 하수인, 4: 악마, 5: 여행자, 6: 전설, 7: 로릭, 0: 미정
     */
    parseTeam(teamValue) {
        if (typeof teamValue === 'number') return teamValue;
        
        const teamMap = {
            "townsfolk": 1,
            "outsider": 2,
            "minion": 3,
            "demon": 4,
            "traveler": 5,
            "fabled": 6,
            "loric": 7
        };
        return teamMap[String(teamValue).toLowerCase()] || 0;
    }
}