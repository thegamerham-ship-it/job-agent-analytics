document.addEventListener('DOMContentLoaded', () => {
    const jobCardsContainer = document.getElementById('job-cards-container');
    const targetJobSelect = document.getElementById('target-job-select');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resetBtn = document.getElementById('reset-btn');

    const gapForm = document.getElementById('gap-form');
    const submitBtn = document.getElementById('submit-btn');
    const resultContainer = document.getElementById('result-container');

    const resStrengths = document.getElementById('res-strengths');
    const resGaps = document.getElementById('res-gaps');
    const resPriority = document.getElementById('res-priority');
    const resProject = document.getElementById('res-project');

    let currentJobs = [];
    let selectedJob = null;

    // 실시간 잡 사이트 검색 요청 함수
    async function searchLiveJobs(keyword) {
        if (!keyword) {
            alert('검색어를 입력해주세요. (예: 게임, AI 에이전트, 넥슨)');
            return;
        }

        jobCardsContainer.innerHTML = '<p class="loading-text">인터넷 잡 사이트들을 탐색하며 최신 공고를 수집 및 분석 중입니다... (약 5~10초 소요)</p>';
        document.getElementById('access-report-box').classList.add('hidden');
        searchBtn.disabled = true;

        try {
            const res = await fetch(`/api/jobs/live?keyword=${encodeURIComponent(keyword)}`);
            if (!res.ok) throw new Error('공고 실시간 수집에 실패했습니다.');

            const data = await res.json();
            // 새로운 응답 구조 (data.jobs 와 data.search_logs 분기 처리)
            const jobs = data.jobs || data;
            const logs = data.search_logs;

            currentJobs = jobs;
            selectedJob = null;

            renderAccessReport(logs);
            renderJobCards(jobs);
            populateJobSelect(jobs);
        } catch (error) {
            console.error(error);
            jobCardsContainer.innerHTML = `<p class="loading-text">실시간 공고를 불러오지 못했습니다: ${error.message}</p>`;
        } finally {
            searchBtn.disabled = false;
        }
    }

    function renderAccessReport(logs) {
        const reportBox = document.getElementById('access-report-box');
        const successSpan = document.getElementById('report-success');
        const failedSpan = document.getElementById('report-failed');

        if (!logs) {
            reportBox.classList.add('hidden');
            return;
        }

        const successList = logs.success_sites ? logs.success_sites.join(', ') : '없음';
        const failedList = logs.failed_or_blocked_sites && logs.failed_or_blocked_sites.length > 0
            ? logs.failed_or_blocked_sites.join(', ')
            : '차단/누락된 사이트 없음';

        successSpan.textContent = `✅ 수집 성공: [${successList}]`;
        failedSpan.textContent = `❌ 접근 실패/미수집: [${failedList}]`;
        reportBox.classList.remove('hidden');
    }

    function renderJobCards(jobs) {
        jobCardsContainer.innerHTML = '';
        if (!jobs || jobs.length === 0) {
            jobCardsContainer.innerHTML = '<p class="loading-text">검색된 실시간 공고가 없습니다.</p>';
            return;
        }

        jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'job-card';
            card.dataset.jobId = job.id;

            // 회사 이름을 이용해 사람인 통합 검색 결과 페이지로 바로 연결
            const searchQuery = encodeURIComponent(job.company);
            const targetUrl = `https://www.saramin.co.kr/zf_user/search/recruit?searchword=${searchQuery}`;
            // ----------------------------------------------------

            card.innerHTML = `
        <div class="card-header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="company-name">${job.company}</span>
            <span style="font-size: 0.75rem; background: #334155; padding: 2px 6px; border-radius: 4px; color: #38bdf8;">출처: ${job.source_site || '웹 크롤링'}</span>
          </div>
          <h3 class="role-title" style="margin-top: 5px;">${job.role}</h3>
          <span class="domain-badge">${job.domain || 'IT/게임'}</span>
        </div>
        <p style="font-size: 0.9rem; margin-bottom: 0.5rem; color: #cbd5e1;">${job.summary || ''}</p>
        
        <span class="badge-label must">필수 요건</span>
        <ul class="skills-list">
          ${(job.must_have || []).map(skill => `<li>${skill}</li>`).join('')}
        </ul>

        <span class="badge-label nice">우대 사항</span>
        <ul class="skills-list">
          ${(job.nice_to_have || []).map(skill => `<li>${skill}</li>`).join('')}
        </ul>

        <div style="margin-top: 10px; text-align: right;">
          <a href="${job.job_url || '#'}" target="_blank" class="job-link-btn" style="font-size: 0.8rem; color: #38bdf8; text-decoration: underline;" onclick="event.stopPropagation();">공고 원문 바로가기 🔗</a>
        </div>
      `;

            card.addEventListener('click', () => {
                selectJob(job);
            });

            jobCardsContainer.appendChild(card);
        });
    }

    function populateJobSelect(jobs) {
        targetJobSelect.innerHTML = '<option value="">진단할 공고 카드를 클릭하거나 선택하세요</option>';
        jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = `[${job.company}] ${job.role}`;
            targetJobSelect.appendChild(option);
        });
    }

    function selectJob(job) {
        selectedJob = job;
        targetJobSelect.value = job.id;

        document.querySelectorAll('.job-card').forEach(card => {
            if (card.dataset.jobId === job.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        gapForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    targetJobSelect.addEventListener('change', (e) => {
        const found = currentJobs.find(j => j.id === e.target.value);
        if (found) selectJob(found);
    });

    searchBtn.addEventListener('click', () => searchLiveJobs(searchInput.value.trim()));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchLiveJobs(searchInput.value.trim());
    });

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        jobCardsContainer.innerHTML = '<p class="loading-text">상단 검색창에 키워드(예: 게임, AI 에이전트)를 입력하고 검색하세요.</p>';
        targetJobSelect.innerHTML = '<option value="">검색 후 공고를 선택하세요</option>';
        currentJobs = [];
        selectedJob = null;
    });

    // 실시간 진단 실행
    gapForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedJob) {
            alert('비교할 타깃 공고 카드를 먼저 선택해주세요.');
            return;
        }

        const userExperience = document.getElementById('user-experience').value.trim();
        if (!userExperience) return;

        submitBtn.disabled = true;
        submitBtn.textContent = '선택한 실시간 공고와 역량을 비교 진단 중입니다...';
        resultContainer.classList.add('hidden');

        try {
            const response = await fetch('/api/analyze-gap-live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_job: selectedJob,
                    user_experience: userExperience
                })
            });

            if (!response.ok) throw new Error('진단 요청에 실패했습니다.');

            const data = await response.json();
            renderAnalysisResult(data);
        } catch (error) {
            alert('오류 발생: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '선택한 공고와 AI 역량 갭 진단 실행';
        }
    });

    function renderAnalysisResult(result) {
        resStrengths.innerHTML = result.strengths.map(item => `<li>${item}</li>`).join('');
        resGaps.innerHTML = result.critical_gaps.map(item => `<li>${item}</li>`).join('');
        resPriority.innerHTML = result.learning_priority.map(item => `<li>${item}</li>`).join('');
        resProject.textContent = result.recommended_project;

        resultContainer.classList.remove('hidden');
        resultContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // 초기 안내 문구
    jobCardsContainer.innerHTML = '<p class="loading-text">상단 검색창에 원하는 키워드(예: 게임, AI 기획, 넷마블)를 입력해 실시간 공고를 검색해 보세요.</p>';
});