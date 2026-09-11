import os
import re
import json
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from google import genai
from google.genai import types

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="AI Agent Realtime Job Analytics")
client = genai.Client(api_key=api_key) if api_key else None

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

class LiveGapAnalysisRequest(BaseModel):
    user_experience: str
    target_job: dict

def extract_json(text: str):
    """모델 응답에서 JSON 배열 또는 객체를 안전하게 추출"""
    match = re.search(r'\[.*\]|\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text.strip())

@app.get("/api/jobs/live")
def search_live_jobs(keyword: str = Query(..., description="검색할 채용 키워드")):
    if not client or not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    prompt = f"""
당신은 대한민국 테크/게임 업계 전문 헤드헌터입니다.
웹 검색을 통해 2026년 기준 사람인, 원티드, 잡코리아 및 기업 채용 페이지에서 
'{keyword}'와 관련된 [AI Agent, LLM, 생성형 AI, 자동화, 데이터/시나리오 기획] 분야의 실제 최신 채용 공고 5~6개를 선별하여 분석하세요.
단순 일반 웹/인프라 공고는 제외하고, AI 모델 연동 및 지능형 에이전트와 연관된 포지션을 우선적으로 찾아야 합니다.

반드시 아래 JSON 배열 규격으로만 응답하세요. 다른 설명 없이 오직 JSON만 반환해야 합니다:
[
  {{
    "id": "고유ID(예: job-1)",
    "company": "회사명",
    "role": "채용 포지션명",
    "domain": "분야/도메인",
    "must_have": ["필수 자격 요건 3~4개"],
    "nice_to_have": ["우대 요건 3~4개"],
    "summary": "주요 업무 및 공고 요약"
  }}
]
"""

    try:
        # 검색 도구 활성화 (response_mime_type 충돌을 피해 텍스트 추출 후 파싱)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
            )
        )
        
        raw_text = response.text or ""
        if not raw_text and response.candidates:
            # candidate 내부 파트에서 텍스트 수집
            for part in response.candidates[0].content.parts:
                if getattr(part, 'text', None):
                    raw_text += part.text

        jobs_data = extract_json(raw_text)
        return jobs_data

    except Exception as e:
        print(f"SEARCH ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"실시간 공고 검색 처리 실패: {str(e)}")

@app.post("/api/analyze-gap-live")
def analyze_gap_live(req: LiveGapAnalysisRequest):
    if not client or not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    target_job = req.target_job

    prompt = f"""
당신은 테크/게임 분야 전문 AI 에이전트 채용 컨설턴트입니다.
사용자의 기존 경력과 실시간 채용 공고를 비교 분석하여 역량 갭(Gap)과 액션 플랜을 제시하세요.

[실시간 수집된 타깃 공고]
- 회사: {target_job.get('company')}
- 직무: {target_job.get('role')}
- 도메인: {target_job.get('domain')}
- 필수 요건: {', '.join(target_job.get('must_have', []))}
- 우대 사항: {', '.join(target_job.get('nice_to_have', []))}

[사용자 보유 역량/경력]
{req.user_experience}

반드시 아래 JSON 스키마 형식으로만 순수 JSON을 출력하세요:
{{
  "strengths": ["사용자가 이미 보유한 강점 2~3개"],
  "critical_gaps": ["반드시 보완해야 할 핵심 역량 2~3개"],
  "learning_priority": ["우선순위 순서대로 정렬된 학습 키워드"],
  "recommended_project": "이 사용자에게 가장 적합한 실무 포트폴리오 프로젝트 주제 및 구현 팁"
}}
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text.strip())
    except Exception as e:
        print(f"ANALYSIS ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"진단 생성 실패: {str(e)}")

@app.get("/")
def read_root():
    from fastapi.responses import FileResponse
    return FileResponse(BASE_DIR / "static" / "index.html")