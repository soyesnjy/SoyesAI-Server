const openAIController_Regercy = {
  // (Legacy) 자율 상담 AI
  postOpenAIChattingNew: async (req, res) => {
    const { messageArr } = req.body;
    console.log("자율 상담 API /message Path 호출");
    let parseMessageArr;

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      const user_name = "예나";

      // parseMessageArr.push({
      //   role: "user",
      //   content: `문제 해결이 아닌 공감 위주의 답변을 30자 이내로 작성하되, 종종 해결책을 제시해줘`,
      // });

      const response = await openai.chat.completions.create({
        messages: [
          base_pupu,
          {
            role: "system",
            content: `user의 이름은 '${user_name}'입니다`,
          },
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        // temperature: 0.2,
      });
      // gpt-4-turbo 모델은 OpenAI 유료고객(Plus 결제 회원) 대상으로 사용 권한 지급
      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err.error);
      res.json(err);
    }
  },
  // (Legacy) 테스트 결과 기반 상담 AI. 성격 검사
  postOpenAIPersnalTestResultConsulting: async (req, res) => {
    const { messageArr, testResult } = req.body;
    console.log("성격 검사 반영 API /consulting_persnal Path 호출");

    let parseMessageArr,
      parseTestResult = {};
    // console.log(messageArr);

    // messageArr가 문자열일 경우 json 파싱
    if (typeof messageArr === "string") {
      parseMessageArr = JSON.parse(messageArr);
    } else parseMessageArr = [...messageArr];

    if (typeof testResult === "string") {
      parseTestResult = JSON.parse(messageArr);
    } else if (!testResult) {
      // default 검사 결과
      parseTestResult.persnal = "IFPE";
    } else parseTestResult.persnal = testResult;

    // console.log(persnal_short[parseTestResult.persnal]);

    try {
      const response = await openai.chat.completions.create({
        temperature: 1,
        messages: [
          base_pupu,
          // 성격검사결과 반영 Prompt
          {
            role: "system",
            content: `
                user의 성격은 ${persnal_short[parseTestResult.persnal]}
                assistant는 user의 성격을 이미 알고 있습니다. 유저의 성격을 반영하여 대화를 진행해주세요.
                다음 문단은 user의 성격검사 결과에 따른 전문가의 양육 코칭 소견입니다. 
                '''
                ${persnal_long[parseTestResult.persnal]}
                '''
                해당 소견을 참조하여 답변을 생성해주세요.
                `,
          },
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-1106, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
  // (Legacy) 테스트 결과 기반 상담 AI. 정서행동 검사 - 학교생활 V1
  postOpenAIEmotionTestResultConsulting: async (req, res) => {
    const { messageArr } = req.body;
    // console.log("anxiety_depression");
    console.log("정서행동 검사 반영 상담 API /consulting_emotion Path 호출");
    // console.log(messageArr);

    let parseMessageArr,
      parseTestResult = {};

    parseTestResult.emotional_behavior = {
      adjust_school: 8,
      peer_relationship: -1,
      family_relationship: -1,
      overall_mood: -1,
      unrest: -1,
      depressed: -1,
      physical_symptoms: 7,
      focus: -1,
      hyperactivity: -1,
      aggression: -1,
      self_awareness: -1,
    };

    // console.log(JSON.stringify(parseTestResult.emotional_behavior));

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      const response = await openai.chat.completions.create({
        messages: [
          // Base Prompt
          base_pupu,
          // 정서행동결과 반영 Prompt
          // {
          //   role: "user",
          //   content: `
          //   다음에 오는 문단은 아동의 정서행동검사의 척도에 대한 설명입니다.
          //   '''
          //   ${behavioral_rating_scale}
          //   '''
          //   다음에 오는 문단은 아동의 정서행동검사 척도에 대한 기준입니다.
          //   score 값에 따라 위험/주의/경고 3가지 기준으로 나뉘어집니다.
          //   '''
          //   ${behavioral_rating_standard}
          //   '''
          //   다음에 오는 문단은 아동의 정서행동검사 결과입니다.
          //   객체의 각 변수값을 score에 대입합니다. 값이 -1일 경우 무시합니다.
          //   '''
          //   ${JSON.stringify(parseTestResult.emotional_behavior)}
          //   '''
          //   해당 결과를 반영하여 답변을 생성해주세요.
          //   `,
          // },
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-1106, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
  // (Legacy) 테스트 결과 기반 상담 AI. 정서행동 검사 - 학교생활 V2
  postOpenAIEmotionTestResultConsultingV2: async (req, res) => {
    const { messageArr, pUid } = req.body;
    console.log(
      "정서행동 검사- 학교생활 V2 반영 상담 API /consulting_emotion_v2 Path 호출"
    );
    let parseMessageArr, parsepUid; // Parsing 변수
    let test_prompt_content; // 심리 검사 결과 문장 저장 변수

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";
      // console.log(parsepUid);

      // 동기식 DB 접근 함수 1. Promise 생성 함수
      function queryAsync(connection, query, parameters) {
        return new Promise((resolve, reject) => {
          connection.query(query, parameters, (error, results, fields) => {
            if (error) {
              reject(error);
            } else {
              resolve(results);
            }
          });
        });
      }
      // 프로미스 resolve 반환값 사용. (User Data return)
      async function fetchUserData(connection, query) {
        try {
          let results = await queryAsync(connection, query, []);
          // console.log(results[0]);
          return results;
        } catch (error) {
          console.error(error);
        }
      }

      const user_table = "soyes_ai_Ebt_School"; // DB Table Name
      const user_attr = {
        pKey: "uid",
        // attr1: "",
      }; // DB Table Attribue

      const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${parsepUid}'`; // Select Query
      const ebt_school_data = await fetchUserData(connection_AI, select_query);

      // console.log(ebt_school_data[0]);
      delete ebt_school_data[0].uid; // uid 속성 삭제
      // Attribute의 값이 2인 요소의 배열 필터링
      const problem_attr_arr = Object.keys(ebt_school_data[0]);
      const problem_attr_nameArr = problem_attr_arr.filter(
        (el) => el.includes("question") && ebt_school_data[0][el] === 2
      );

      // 문답 개수에 따른 시나리오 문답 투척
      // Attribute의 값이 0인 요소가 없는 경우
      if (problem_attr_nameArr.length === 0) {
        test_prompt_content = "";

        console.log(test_prompt_content);
      } else {
        // 점수가 0인 값들 중 랜덤 문항 도출
        // const random_index = Math.floor(
        //   Math.random() * problem_attr_nameArr.length
        // );
        // // console.log(random_index);
        // const random_question = problem_attr_nameArr[random_index];
        // const selected_question = ebt_Question[random_question];
        // console.log(selected_question);

        test_prompt_content = problem_attr_nameArr
          .map((el) => ebt_School_Result[el])
          .join(" ");

        console.log(test_prompt_content);
      }

      /* 개발자 의도 질문 - N번째 문답에 대한 답변을 개발자가 임의로 지정 */

      // 유저 첫 질문 답변 - 정서행동검사 실시했음을 언급
      if (parseMessageArr.length === 1 && test_prompt_content) {
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 답변한 뒤, 내가 정서행동검사를 실시했음을 언급해줘. 해결책은 제시하지 말아줘.`,
        });
      }
      // 유저 네번째 질문 답변 - 정서행동검사 솔루션 제공
      if (parseMessageArr.length === 5 && test_prompt_content) {
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 답변한 뒤, 심리 검사 결과에 대한 해결책을 자연스럽게 추천해줘. 해결책을 이미 추천했다면 다른 해결책을 추천해줘.`,
        });
      }

      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `다음에 오는 문단은 user의 정서행동검사 결과입니다.
                '''
                ${test_prompt_content}
                '''
                위 문단에 아무 내용이 없다면 user의 심리 상태는 문제가 없습니다.
                `,
          },
          base_pupu,
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        // temperature: 1.2,
      });
      // gpt-4-turbo 모델은 OpenAI 유료고객(Plus 결제 회원) 대상으로 사용 권한 지급
      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err.error);
      res.json(err);
    }
  },
  // (Legacy) 테스트 결과 기반 상담 AI. 정서행동, 성격검사, 진로검사 - V1 (박사님 프롬프트)
  postOpenAITestResultConsultingV1: async (req, res) => {
    const { EBTData } = req.body;

    console.log("Test 결과 반영 검사- V1 상담 API /consulting_lala Path 호출");
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // EBT 반영 Class 정의
    // const EBT_classArr = ["School", "Friend", "Family"];
    // const EBT_ObjArr = {
    //   School: { table: "soyes_ai_Ebt_School", result: ebt_School_Result },
    //   Friend: { table: "soyes_ai_Ebt_Friend", result: ebt_Friend_Result },
    //   Family: { table: "soyes_ai_Ebt_Family", result: ebt_Family_Result },
    // };

    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;

      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";
      // console.log(parsepUid);

      // 고정 삽입 프롬프트
      // promptArr.push(persona_prompt_lala2); // 페르소나 프롬프트 삽입
      // promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      // 박사님 프롬프트 삽입
      if (parsepUid.includes("20240304_v2")) {
        console.log("test_prompt_20240304_v2 삽입");
        promptArr.push(test_prompt_20240304_v2);
      } else if (parsepUid.includes("20240305_v1")) {
        console.log("test_prompt_20240305_v1 삽입");
        promptArr.push(test_prompt_20240305_v1);
      } else {
        console.log("test_prompt_20240304 삽입");
        promptArr.push(test_prompt_20240304);
      }

      // let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt

      // 해당 계정의 모든 정서행동검사 결과 DB에서 차출
      //     const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
      //       const select_Ebt_School_result = await select_soyes_AI_Ebt_Table(
      //         EBT_ObjArr[ebt_class].table, // Table Name
      //         {
      //           pKey: "uid",
      //         }, // primary Key Name
      //         EBT_ObjArr[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
      //         parsepUid // Uid
      //       );

      //       // console.log(select_Ebt_School_result);

      //       const psy_testResult_prompt = {
      //         role: "system",
      //         content: `다음에 오는 문단은 user의 ${ebt_class} 관련 심리검사 결과입니다.
      // '''
      // ${select_Ebt_School_result.testResult}
      // '''
      // 위 문단이 비어있다면 ${
      //   // DB Table의 값 유무에 따라 다른 프롬프트 입력
      //   !select_Ebt_School_result.ebt_school_data[0]
      //     ? "user는 심리검사를 진행하지 않았습니다."
      //     : "user의 심리검사 결과는 문제가 없습니다."
      // }`,
      //       };
      //       // console.log(psy_testResult_prompt);
      //       return psy_testResult_prompt;
      //     });

      //     // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
      //     await Promise.all(psy_testResult_promptArr).then((prompt) => {
      //       psy_testResult_promptArr_last = [...prompt]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
      //     });

      // console.log(psy_testResult_promptArr_last);

      /* 개발자 의도 질문 - N번째 문답에 대한 답변을 개발자가 임의로 지정 */

      // if (parseMessageArr.length) {
      //   // 심리 검사 결과 프롬프트 삽입
      //   console.log("심리 검사 결과 프롬프트 삽입");
      //   promptArr.push(...psy_testResult_promptArr_last);
      //   promptArr.push(psyResult_prompt);
      //   promptArr.push(solution_prompt);
      // }

      // if (parseMessageArr.length === 1) {
      //   // 고정 답변1 프롬프트 삽입
      //   console.log("고정 답변1 프롬프트 삽입");

      //   const random_class =
      //     EBT_classArr[Math.floor(Math.random() * EBT_classArr.length)];
      //   console.log(random_class);
      //   parseMessageArr.push({
      //     role: "user",
      //     content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 5문장 이내로 설명해줘. 이후 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
      //   });
      //   promptArr.push({
      //     role: "system",
      //     content: `이번 문답은 예외적으로 6문장 이내로 답변을 생성합니다.`,
      //   });
      // }

      // if (parseMessageArr.length === 17 || parseMessageArr.length === 19) {
      //   // 솔루션 프롬프트 삽입
      //   console.log("솔루션 프롬프트 삽입");
      //   promptArr.push(solution_prompt);
      // }

      // 상시 삽입 프롬프트
      // promptArr.push(common_prompt); // 공통 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      // console.log(emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // (Legacy) 정서멘토 모델 - 엘라
  postOpenAIConsultingLala: async (req, res) => {
    const { EBTData } = req.body;
    // console.log(EBTData);
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    let testClass = "",
      testClass_cb = "";
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // 응답에 헤더를 추가하는 메서드
    // res.header("Test_Header", "Success Header");
    // console.log(req.session.accessToken);

    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.json({ message: "No pUid input value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;
      console.log(
        `엘라 상담 API /consulting_emotion_lala Path 호출 - pUid: ${parsepUid}`
      );

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_lala_v4); // 엘라 페르소나
      promptArr.push(info_prompt); // 유저관련 정보

      const lastUserContent =
        parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      // NO REQ 질문 처리. 10초 이상 질문이 없을 경우 Client 측에서 'NO REQUEST' 메시지를 담은 요청을 보냄. 그에 대한 처리
      if (lastUserContent.includes("NO REQ")) {
        console.log("NO REQUEST 전달");
        parseMessageArr.pop(); // 'NO REQUEST 질문 삭제'
        parseMessageArr.push(no_req_prompt);
        promptArr.push(sentence_division_prompt);

        const response = await openai.chat.completions.create({
          messages: [...promptArr, ...parseMessageArr],
          model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        });

        res.json({
          message: response.choices[0].message.content,
          emotion: 0,
        });

        return;
      }

      /* 프롬프트 삽입 분기 */

      /* 심리 검사 결과 프롬프트 상시 삽입 */
      // 세션에 psy_testResult_promptArr_last 값이 없는 경우
      if (!req.session.psy_testResult_promptArr_last) {
        console.log("심리 검사 결과 프롬프트 삽입");
        let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt

        // 해당 계정의 모든 정서행동검사 결과를 DB에서 차출
        const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
          const select_Ebt_Result = await select_soyes_AI_Ebt_Table(
            EBT_Table_Info[ebt_class].table, // Table Name
            EBT_Table_Info[ebt_class].attribute,
            EBT_Table_Info[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
            parsepUid // Uid
          );

          // console.log(select_Ebt_Result);

          const psy_testResult_prompt = {
            role: "system",
            content: `다음에 오는 문단은 user의 ${ebt_class} 관련 심리검사 결과입니다.
              '''
              ${select_Ebt_Result.testResult}
              '''
              위 문단이 비어있다면 ${
                // DB Table의 값 유무에 따라 다른 프롬프트 입력
                !select_Ebt_Result.ebt_school_data[0]
                  ? "user는 심리검사를 진행하지 않았습니다."
                  : "user의 심리검사 결과는 문제가 없습니다."
              }`,
          };
          // console.log(psy_testResult_prompt);
          return psy_testResult_prompt;
        });
        // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
        await Promise.all(psy_testResult_promptArr).then((prompt) => {
          psy_testResult_promptArr_last = [...prompt]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
        });

        // console.log(psy_testResult_promptArr_last);
        promptArr.push(...psy_testResult_promptArr_last);
        // DB 접근 최소화를 위해 세션에 psy_testResult_promptArr_last 값 저장
        req.session.psy_testResult_promptArr_last = [
          ...psy_testResult_promptArr_last,
        ];
      }
      // 세션에 psy_testResult_promptArr_last 값이 있는 경우
      else {
        console.log("세션 저장된 심리 검사 결과 프롬프트 삽입");
        promptArr.push(...req.session.psy_testResult_promptArr_last);
      }

      // 음악 명상 + 그림 명상 관련 솔루션 프롬프트
      promptArr.push(solution_prompt2);

      /* 검사 결과 분석 관련 멘트 감지 */
      if (
        test_result_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass = el.class; // 검사 분야 저장
            return true;
          } else return false;
        })
      ) {
        console.log(`정서행동검사 결과 - ${testClass} 분석 프롬프트 삽입`);
        // 감지된 분야 선택
        // const random_class = EBT_classArr[class_map[testClass]];
        const random_class = testClass;

        // 심리 결과 분석 프롬프트
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
            '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 분석한 아동의 심리 상태를 5문장 이내로 설명해줘.
            만약 심리 검사 결과를 진행하지 않았다면, 잘 모르겠다고 답변해줘.
            . 혹은 ? 같은 특수문자로 끝나는 각 마디 뒤에는 반드시 줄바꿈(\n)을 추가해줘.
            검사 결과가 있다면 답변 마지막에는 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
        });
        promptArr.push({
          role: "system",
          content: `이번 문답은 예외적으로 6문장 이내로 답변을 생성합니다.`,
        });
        // 검사 분야 세션 추가. 해당 세션동안 검사 결과 분석은 1회만 진행되도록 세션 데이터 설정.
        req.session.ebt_class = random_class;
      }
      /* 인지행동 관련 멘트 감지 */
      // 인지행동 세션 데이터가 없고, 인지행동 검사 관련 멘트 감지
      else if (
        !req.session.cb_class &&
        cb_solution_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass_cb = el.class; // 인지 분야 저장
            return true;
          } else return false;
        })
      ) {
        // 고정 답변3 프롬프트 삽입 - 인지행동 치료 문제
        console.log("인지행동 치료 프롬프트 삽입");
        let cb_testArr;

        // 인지행동 문항 맵핑
        const cb_class_map = {
          school: cb_test_school,
          friend: cb_test_family,
          family: cb_test_friend,
          etc: cb_test_remain,
        };

        // 감지된 인지행동 문제 분야 선택
        cb_testArr = cb_class_map[testClass_cb];
        req.session.cb_class = testClass_cb;

        // 랜덤 문항 1개 선택
        const random_cb_index = Math.floor(Math.random() * cb_testArr.length);
        const random_cb_question = cb_testArr[random_cb_index];
        req.session.cb_question = random_cb_question;

        // console.log(random_cb_question);

        // 인지행동 문제 프롬프트
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
            이후 '그 전에 우리 상황극 한 번 하자!' 라고 말한 뒤 다음 문단에 오는 인지행동 검사를 문제와 문항으로 나누어 user에게 제시해줘.
  
            ${random_cb_question.question}
  
            문항 앞에는 '1) 2) 3) 4)'같이 번호를 붙이고 점수는 제거해줘.
            답변 마지막에 '넌 이 상황에서 어떻게 할거야? 번호로 알려줘!'를 추가해줘.
            `,
        });
        promptArr.push({
          role: "system",
          content: `이번 문답은 예외적으로 8문장 이내로 답변을 생성합니다.`,
        });
      }
      /* 인지행동 세션 돌입 */
      // 인지행동 세션 데이터가 있는 경우
      else if (req.session.cb_class) {
        // 정답을 골랐을 경우
        if (lastUserContent.includes(req.session.cb_question.answer)) {
          console.log("인지행동 검사 정답 선택");
          parseMessageArr.push({
            role: "user",
            content: `'올바른 답을 골랐구나! 대단해!'를 말한 뒤 ${req.session.cb_question.answer}번 문항에 대한 견해를 2문장 이내로 답변해줘.`,
          });

          // 인지행동 관련 데이터 초기화
          delete req.session.cb_class;
          delete req.session.cb_question;
          delete req.session.cb_wrongCnt;
        }
        // 오답을 고를 경우
        else {
          console.log("인지행동 검사 오답 선택");
          // 오답 횟수 카운트
          if (!req.session.cb_wrongCnt) req.session.cb_wrongCnt = 1;
          else req.session.cb_wrongCnt++;

          // 오답 횟수 4회 미만
          if (req.session.cb_wrongCnt < 4) {
            parseMessageArr.push({
              role: "user",
              content: `'user'가 고른 문항에 대한 견해를 2문장 이내로 답변한 뒤, 마지막에는 '그치만 다시 한 번 생각해봐!' 를 추가해줘.
                (만약 문항을 고르지 않았다면 1문장 이내로 문제에 집중해달라고 'user'에게 부탁해줘. 이 때는 '그치만 다시 한 번 생각해봐!'를 추가하지마.)`,
            });
          }
          // 오답 횟수 4회 이상
          else {
            console.log("인지행동 검사 오답 4회 이상 선택 -> 정답 알려주기");
            parseMessageArr.push({
              role: "user",
              content: `'올바른 답은 ${req.session.cb_question.answer}번이였어!' 를 말한 뒤 마지막 ${req.session.cb_question.answer}번 문항에 대한 견해를 2문장 이내로 답변해줘.`,
            });

            // 인지행동 관련 데이터 초기화
            delete req.session.cb_class;
            delete req.session.cb_question;
            delete req.session.cb_wrongCnt;
          }
        }
      } else promptArr.push(sentence_division_prompt);

      /*
        // 답변 횟수 카운트
        if (!req.session.answerCnt || parseMessageArr.length === 1)
          req.session.answerCnt = 1;
        else if (req.session.answerCnt > 9) {
          // 답변 10회 이상 진행 시 세션 파괴
          req.session.destroy();
          res.clearCookie("connect.sid");
        } else req.session.answerCnt++;
        */

      // 상시 삽입 프롬프트
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-turbo", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      console.log("emotion: " + emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      // 대화 내역 로그
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);

      // 세션 확인 코드
      // console.log(req.session);

      res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
        emotion: 0,
      });
    }
  },
  // (Legacy) User 정서행동 검사 결과 반환
  postOpenAIUserEBTResultData: async (req, res) => {
    const { data } = req.body;
    let parseData,
      parsepUid,
      returnArr = [];

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, contentKey } = parseData;
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }
      // pUid default값 설정
      parsepUid = pUid;
      console.log(
        `User 정서행동 검사 결과 반환 API /openAI/ebtresult Path 호출 - pUid: ${parsepUid}`
      );

      /*
        // EBT DB에서 차출 - Obj
        await Promise.all(
          EBT_classArr.map(async (ebt_class) => {
            // 분야별 값 조회
            const select_Ebt_Result = await select_soyes_AI_Ebt_Result(
              EBT_Table_Info[ebt_class],
              parsepUid // Uid
            );
            returnObj[ebt_class] = { ...select_Ebt_Result };
          })
        );
        // console.log(returnObj);
        */

      // EBT DB에서 차출 - Arr
      const ebtResultArr = EBT_classArr.map(async (ebt_class) => {
        const select_Ebt_Result = await select_soyes_AI_Ebt_Result(
          EBT_Table_Info[ebt_class],
          parsepUid // Uid
        );
        // contentKey 값이 입력되지 않을 경우 analysisResult 속성 삭제
        if (!contentKey) delete select_Ebt_Result.content;
        return { ebt_class, ...select_Ebt_Result };
      });
      // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
      await Promise.all(ebtResultArr).then((result) => {
        returnArr = [...result]; // resolve 상태로 반환된 배열을 returnArr 변수에 복사
      });
      // console.log(returnArr);

      return res.status(200).json({
        message: "User EBT Result Return Success!",
        data: returnArr.sort((a, b) => b.tScore - a.tScore),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // (Legacy) 정서멘토 모델 - 엘라
  postOpenAIConsultingLala: async (req, res) => {
    const { data } = req.body;
    // console.log(EBTData);
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    let userPrompt = []; // 삽입 User Prompt Array
    // let testClass = "",
    //   testClass_cb = "";

    try {
      if (typeof data === "string") {
        parseEBTdata = JSON.parse(data);
      } else parseEBTdata = data;

      const { messageArr, pUid, type } = parseEBTdata;

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }
      // No type => return
      if (!type) {
        console.log("No type input value - 404");
        return res.status(404).json({ message: "No type input value - 404" });
      }
      // No type => return
      if (!messageArr) {
        console.log("No messageArr input value - 404");
        return res
          .status(404)
          .json({ message: "No messageArr input value - 404" });
      }

      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid;
      console.log(
        `엘라 상담 API /consulting_emotion_lala Path 호출 - pUid: ${parsepUid}`
      );

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_lala_v5); // 엘라 페르소나
      promptArr.push(info_prompt); // 유저관련 정보

      // 유저 마지막 멘트
      // const lastUserContent =
      //   parseMessageArr[parseMessageArr.length - 1].content;

      // 대화 6회 미만 - 심리 상담 프롬프트 삽입
      if (parseMessageArr.length < 11) {
        console.log("심리 상담 프롬프트 삽입");
        promptArr.push(EBT_Table_Info[type].consult);
      }
      // 대화 6회 - 심리 상담 프롬프트 + 심리 상태 분석 프롬프트 삽입
      else if ((parseMessageArr.length + 1) % 12 === 0) {
        console.log("심리 상담 프롬프트 + 심리 요약 프롬프트 삽입");
        promptArr.push(EBT_Table_Info[type].consult);
        // 비교 분석용 EBT class 맵
        const compareTypeMap = {
          School: ["School", "Attention"], // 학업/성적 상담은 School, Attention 분석과 비교하여 해석.
          Friend: ["Friend", "Movement"],
          Family: ["Family"],
          Mood: ["Mood", "Unrest", "Sad", "Angry"],
          Health: ["Health"],
          Self: ["Self"],
        };

        let resolvedCompareEbtAnalysis; // EBT 분석을 담을 배열

        // compareTypeMap에 맵핑되는 분야의 검사 결과를 DB에서 조회
        const compareEbtAnalysis = await compareTypeMap[type].map(
          async (ebtClass) => {
            return await select_soyes_AI_Ebt_Analyis(
              EBT_Table_Info[ebtClass],
              parsepUid
            );
          }
        );
        // Promise Pending 대기
        await Promise.all(compareEbtAnalysis).then((data) => {
          resolvedCompareEbtAnalysis = [...data]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
        });
        // userPrompt 명령 추가
        userPrompt.push({
          role: "user",
          content: `아래는 user의 정서행동검사 결과야.
            '''
            ${resolvedCompareEbtAnalysis.map((data) => {
              const { ebtClass, analyisResult } = data;
              return `
              ${ebtClass}: { ${
                analyisResult === "NonTesting"
                  ? `'정서행동검사 - ${analyisResult}'을 실시하지 않았습니다.`
                  : analyisResult
              }}
              `;
            })}
            '''
            지금까지 대화를 기반으로 user의 심리 상태를 3문장으로 요약하고, 위 정서행동검사 결과와 비교하여 2문장으로 해석해줘.
              `,
        });
      }
      // 대화 7회 - 더미 데이터 반환 (7회마다)
      else if ((parseMessageArr.length + 1) % 14 === 0) {
        console.log("더미 데이터 반환 (클라이언트의 솔루션 획득 시점)");
        const message = {
          message: "Dummy Message",
          emotion: 0,
        };
        return res.status(200).json(message);
      }
      // 대화 8회 초과 - 심리 솔루션 프롬프트 삽입 || 기본 상담 프롬프트 삽입
      else {
        console.log(
          `심리 솔루션 프롬프트 삽입 - solution:${req.session.solution?.solutionClass}`
        );
        // 유저 마지막 멘트
        const lastUserContent =
          parseMessageArr[parseMessageArr.length - 1].content;
        // console.log(lastUserContent);

        // 컨텐츠 실시 여부 선택 세션 - 9*n회 문답에서 실시
        if (
          lastUserContent.includes("false") ||
          lastUserContent.includes("true")
        ) {
          // 컨텐츠를 실시할 경우
          if (lastUserContent.includes("true")) {
            let message = {
              message: "좋아! 그럼 명상에 집중해보자!",
              emotion: 0,
            };
            // 컨텐츠 종류에 따른 고정 멘트 반환
            switch (req.session?.solution?.solutionClass) {
              // 명상
              case "meditation":
                console.log(`명상 고정 멘트 반환`);
                message.message = "좋아! 그럼 명상에 집중해보자!";
                delete req.session.solution;
                return res.status(200).json(message);
              // 인지행동
              case "cognitive":
                console.log(`인지행동 고정 멘트 반환`);
                message.message = "좋아! 그럼 문제에 집중해보자!";
                delete req.session.solution;
                return res.status(200).json(message);
              // 디폴트(명상)
              default:
                console.log(`디폴트 멘트 반환`);
                message.message = "좋아! 그럼 디폴트에 집중해보자!";
                delete req.session.solution;
                return res.status(200).json(message);
            }
          }
          // 컨텐츠를 안할 경우 - 솔루션 세션 삭제
          else delete req.session.solution;
        }
        // 세션에 솔루션 관련 프롬프트가 있는 경우는 삽입
        if (req.session.solution?.prompt)
          promptArr.push(req.session.solution.prompt);

        // 8회 이후의 답변은 막아두기
        // req.session.solution
        //   ? promptArr.push(req.session.solution.prompt)
        //   : promptArr.push(EBT_Table_Info[type].solution);

        // 솔루션 세션이 아닌 경우 기본 상담 프롬프트 삽입
        promptArr.push(EBT_Table_Info[type].consult);
      }

      /* 
        // 검사 결과 분석 관련 멘트 감지
        if (
          test_result_ment.some((el) => {
            if (lastUserContent.includes(el.text)) {
              testClass = el.class; // 검사 분야 저장
              return true;
            } else return false;
          })
        ) {
          console.log(`정서행동검사 결과 - ${testClass} 분석 프롬프트 삽입`);
          // 감지된 분야 선택
          // const random_class = EBT_classArr[class_map[testClass]];
          const random_class = testClass;
  
          // 심리 결과 분석 프롬프트
          parseMessageArr.push({
            role: "user",
            content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
            '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 분석한 아동의 심리 상태를 5문장 이내로 설명해줘.
            만약 심리 검사 결과를 진행하지 않았다면, 잘 모르겠다고 답변해줘.
            . 혹은 ? 같은 특수문자로 끝나는 각 마디 뒤에는 반드시 줄바꿈(\n)을 추가해줘.
            검사 결과가 있다면 답변 마지막에는 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
          });
          promptArr.push({
            role: "system",
            content: `이번 문답은 예외적으로 6문장 이내로 답변을 생성합니다.`,
          });
          // 검사 분야 세션 추가. 해당 세션동안 검사 결과 분석은 1회만 진행되도록 세션 데이터 설정.
          req.session.ebt_class = random_class;
        }
        // 인지행동 관련 멘트 감지
        // 인지행동 세션 데이터가 없고, 인지행동 검사 관련 멘트 감지
        else if (
          !req.session.cb_class &&
          cb_solution_ment.some((el) => {
            if (lastUserContent.includes(el.text)) {
              testClass_cb = el.class; // 인지 분야 저장
              return true;
            } else return false;
          })
        ) {
          // 고정 답변3 프롬프트 삽입 - 인지행동 치료 문제
          console.log("인지행동 치료 프롬프트 삽입");
          let cb_testArr;
  
          // 인지행동 문항 맵핑
          const cb_class_map = {
            school: cb_test_school,
            friend: cb_test_family,
            family: cb_test_friend,
            etc: cb_test_remain,
          };
  
          // 감지된 인지행동 문제 분야 선택
          cb_testArr = cb_class_map[testClass_cb];
          req.session.cb_class = testClass_cb;
  
          // 랜덤 문항 1개 선택
          const random_cb_index = Math.floor(Math.random() * cb_testArr.length);
          const random_cb_question = cb_testArr[random_cb_index];
          req.session.cb_question = random_cb_question;
  
          // console.log(random_cb_question);
  
          // 인지행동 문제 프롬프트
          parseMessageArr.push({
            role: "user",
            content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
            이후 '그 전에 우리 상황극 한 번 하자!' 라고 말한 뒤 다음 문단에 오는 인지행동 검사를 문제와 문항으로 나누어 user에게 제시해줘.
  
            ${random_cb_question.question}
  
            문항 앞에는 '1) 2) 3) 4)'같이 번호를 붙이고 점수는 제거해줘.
            답변 마지막에 '넌 이 상황에서 어떻게 할거야? 번호로 알려줘!'를 추가해줘.
            `,
          });
          promptArr.push({
            role: "system",
            content: `이번 문답은 예외적으로 8문장 이내로 답변을 생성합니다.`,
          });
        }
        // 인지행동 세션 돌입
        // 인지행동 세션 데이터가 있는 경우
        else if (req.session.cb_class) {
          // 정답을 골랐을 경우
          if (lastUserContent.includes(req.session.cb_question.answer)) {
            console.log("인지행동 검사 정답 선택");
            parseMessageArr.push({
              role: "user",
              content: `'올바른 답을 골랐구나! 대단해!'를 말한 뒤 ${req.session.cb_question.answer}번 문항에 대한 견해를 2문장 이내로 답변해줘.`,
            });
  
            // 인지행동 관련 데이터 초기화
            delete req.session.cb_class;
            delete req.session.cb_question;
            delete req.session.cb_wrongCnt;
          }
          // 오답을 고를 경우
          else {
            console.log("인지행동 검사 오답 선택");
            // 오답 횟수 카운트
            if (!req.session.cb_wrongCnt) req.session.cb_wrongCnt = 1;
            else req.session.cb_wrongCnt++;
  
            // 오답 횟수 4회 미만
            if (req.session.cb_wrongCnt < 4) {
              parseMessageArr.push({
                role: "user",
                content: `'user'가 고른 문항에 대한 견해를 2문장 이내로 답변한 뒤, 마지막에는 '그치만 다시 한 번 생각해봐!' 를 추가해줘.
                (만약 문항을 고르지 않았다면 1문장 이내로 문제에 집중해달라고 'user'에게 부탁해줘. 이 때는 '그치만 다시 한 번 생각해봐!'를 추가하지마.)`,
              });
            }
            // 오답 횟수 4회 이상
            else {
              console.log("인지행동 검사 오답 4회 이상 선택 -> 정답 알려주기");
              parseMessageArr.push({
                role: "user",
                content: `'올바른 답은 ${req.session.cb_question.answer}번이였어!' 를 말한 뒤 마지막 ${req.session.cb_question.answer}번 문항에 대한 견해를 2문장 이내로 답변해줘.`,
              });
  
              // 인지행동 관련 데이터 초기화
              delete req.session.cb_class;
              delete req.session.cb_question;
              delete req.session.cb_wrongCnt;
            }
          }
        } else promptArr.push(sentence_division_prompt);
        */

      // 상시 삽입 프롬프트
      // promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr, ...userPrompt],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // let emotion = parseInt(response.choices[0].message.content.slice(-1));
      // console.log("emotion: " + emotion);

      const message = {
        message: response.choices[0].message.content,
        emotion: 0,
      };
      // 대화 내역 로그
      // console.log([
      //   ...parseMessageArr,
      //   { role: "assistant", content: response.choices[0].message.content },
      //   // response.choices[0].message.content,
      // ]);

      // 엘라 심리 분석 DB 저장
      if (parseMessageArr.length === 11) {
        const table = Consult_Table_Info["Analysis"].table;
        const attribute = Consult_Table_Info["Analysis"].attribute;

        // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
        const duple_query = `INSERT INTO ${table} (${attribute.pKey}, ${attribute.attr1}) VALUES (?, ?) ON DUPLICATE KEY UPDATE
            ${attribute.attr1} = VALUES(${attribute.attr1});`;

        const duple_value = [parsepUid, JSON.stringify(message)];

        connection_AI.query(duple_query, duple_value, (error, rows, fields) => {
          if (error) console.log(error);
          else console.log("Ella Consult Analysis UPDATE Success!");
        });

        // 엘라 유저 분석 내용 Session 저장
        req.session.ella_analysis = message.message;
      }
      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server Error - 500 Bad Gateway" + err.message,
        emotion: 0,
      });
    }
  },
};

module.exports = {
  openAIController_Regercy,
};
