// ---------- 多学期数据 ----------
let semesters = {};
let currentSemesterId = null;

const DEFAULT_TIME_CONFIG = [
  { section: "1", time: "8:00-9:00" },
  { section: "2", time: "9:10-10:00" },
  { section: "3", time: "10:10-11:00" },
  { section: "4", time: "11:10-12:00" },
  { section: "5", time: "14:00-15:00" },
  { section: "6", time: "15:10-16:00" },
  { section: "7", time: "16:10-17:00" },
  { section: "8", time: "19:00-20:00" }
];

const weeks = ["一", "二", "三", "四", "五", "六", "日"];

let editingCourseId = null;
let currentTimeEditIndex = -1;
let currentViewingCourse = null;

// 辅助函数
function getCurrentSemester() {
  return semesters[currentSemesterId];
}

function saveSemesters() {
  localStorage.setItem('semesters', JSON.stringify(semesters));
  localStorage.setItem('currentSemesterId', currentSemesterId);
}

// 代理：让旧代码中的 allCourses、timeConfig 等自动映射到当前学期
Object.defineProperty(window, 'allCourses', {
  get: () => getCurrentSemester().courses,
  set: (val) => { getCurrentSemester().courses = val; saveSemesters(); }
});
Object.defineProperty(window, 'timeConfig', {
  get: () => getCurrentSemester().timeConfig,
  set: (val) => { getCurrentSemester().timeConfig = val; saveSemesters(); }
});
Object.defineProperty(window, 'MAX_WEEK', {
  get: () => getCurrentSemester().maxWeek,
  set: (val) => { getCurrentSemester().maxWeek = val; saveSemesters(); }
});
Object.defineProperty(window, 'currentWeek', {
  get: () => getCurrentSemester().currentWeek,
  set: (val) => { getCurrentSemester().currentWeek = val; saveSemesters(); }
});

// ---------- 辅助函数 ----------
function showToast(msg, duration = 1800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
    return c;
  });
}

// ---------- 弹窗控制 ----------
function openModal(id) {
  document.getElementById(id).classList.add('show');
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('show');
  if (id === 'courseModal') {
    document.getElementById('courseForm').reset();
    editingCourseId = null;
  }
  if (id === 'editTimeModal') currentTimeEditIndex = -1;
}


// ---------- 核心渲染 ----------
function updateTopDate() {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayOfWeek = weekdays[now.getDay()];
  const dateStr = `${now.getMonth()+1}月${now.getDate()}日 ${dayOfWeek}`;
  document.getElementById('currentDateDisplay').innerText = `📅 ${dateStr}`;
  document.getElementById('currentWeekDisplay').innerHTML = `📖 第${currentWeek}周 · 课程表`;
}

function updateSectionSelectInModal() {
  const select = document.getElementById('courseSection');
  select.innerHTML = '<option value="">请选择节次</option>';
  timeConfig.forEach((item, idx) => {
    const option = document.createElement('option');
    option.value = idx + 1;
    option.textContent = `${item.section}  (${item.time})`;
    select.appendChild(option);
  });
}

// 判断课程是否在当前周显示
function isCourseVisibleInWeek(course, week) {
  if (week < course.startWeek || week > course.endWeek) return false;
  if (course.weekType === 'odd') return week % 2 === 1;
  if (course.weekType === 'even') return week % 2 === 0;
  return true;
}

function quickAddCourse() {
  // 创建临时模态框
  const modalDiv = document.createElement('div');
  modalDiv.className = 'modal';
  modalDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.55);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 30000;
  `;
  modalDiv.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-title">添加新课程</div>
      <div class="form-item">
        <label class="form-label">课程名称 *</label>
        <input type="text" id="newCourseName" class="form-input" placeholder="例：高等数学">
      </div>
      <div class="form-item">
        <label class="form-label">星期 *</label>
        <select id="newCourseWeek" class="form-select">
          <option value="一">星期一</option>
          <option value="二">星期二</option>
          <option value="三">星期三</option>
          <option value="四">星期四</option>
          <option value="五">星期五</option>
          <option value="六">星期六</option>
          <option value="日">星期日</option>
        </select>
      </div>
      <div class="form-item">
        <label class="form-label">节次 *</label>
        <select id="newCourseSection" class="form-select"></select>
      </div>
      <div class="form-item">
        <label class="form-label">教室 *</label>
        <input type="text" id="newCourseRoom" class="form-input" placeholder="如：A101">
      </div>
      <div class="form-item">
        <label class="form-label">教师（选填）</label>
        <input type="text" id="newCourseTeacher" class="form-input" placeholder="选填">
      </div>
      <div class="form-item">
        <label class="form-label">颜色</label>
        <input type="color" id="newCourseColor" class="form-input" value="#2b6ef0">
      </div>
      <div class="modal-buttons">
        <button id="cancelNewCourseBtn" class="modal-btn cancel">取消</button>
        <button id="confirmNewCourseBtn" class="modal-btn confirm">创建</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);

  // 填充节次下拉框
  const sectionSelect = modalDiv.querySelector('#newCourseSection');
  sectionSelect.innerHTML = '<option value="">请选择节次</option>';
  timeConfig.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = idx + 1;
    opt.textContent = `${item.section} (${item.time})`;
    sectionSelect.appendChild(opt);
  });

  const closeModal = () => modalDiv.remove();
  document.getElementById('cancelNewCourseBtn').onclick = closeModal;
  document.getElementById('confirmNewCourseBtn').onclick = () => {
    const name = document.getElementById('newCourseName').value.trim();
    const week = document.getElementById('newCourseWeek').value;
    const section = document.getElementById('newCourseSection').value;
    const room = document.getElementById('newCourseRoom').value.trim();
    if (!name || !week || !section || !room) {
      alert('请填写完整信息（课程名、星期、节次、教室）');
      return;
    }
    const teacher = document.getElementById('newCourseTeacher').value.trim();
    const color = document.getElementById('newCourseColor').value;
    const sectionNum = Number(section);
    
    // 冲突检测：同一星期、同一节次
    const conflict = allCourses.some(c => c.week === week && c.section === sectionNum);
    if (conflict) {
      alert(`冲突：星期${week} 第${sectionNum}节已有课程，请选择其他时间`);
      return;
    }
    
    const newCourse = {
      id: Date.now() + Math.random(),
      name: name,
      teacher: teacher,
      color: color,
      week: week,
      section: sectionNum,
      room: room,
      startWeek: 1,
      endWeek: MAX_WEEK,
      weekType: 'all'
    };
    allCourses.push(newCourse);
    const semester = semesters[currentSemesterId];
    semester.courses.push(newCourse);
    saveSemesters();
    semesters = JSON.parse(localStorage.getItem('semesters'));
    currentSemesterId = localStorage.getItem('currentSemesterId');
    renderFullSettingsPanel();   // 刷新全局设置中的课程列表
    renderFullTable();           // 刷新主课表
    showToast(`课程“${name}”已添加`, 2000);
    closeModal();
  };
}

function renderFullTable() {
  const currentWeekCourses = allCourses.filter(c => isCourseVisibleInWeek(c, currentWeek));
  const container = document.getElementById('dynamicGrid');
  if (!container) return;
  const rowsCount = timeConfig.length;
  const colsCount = weeks.length;
  let colTemplate = `100px repeat(${colsCount}, minmax(92px, 1fr))`;
  let rowTemplate = `56px repeat(${rowsCount}, 78px)`;
  container.style.display = 'grid';
  container.style.gridTemplateColumns = colTemplate;
  container.style.gridTemplateRows = rowTemplate;
  container.style.border = '1px solid #eef2f8';
  container.style.borderRadius = '20px';
  container.innerHTML = '';
  
  // 左上角
  const cornerDiv = document.createElement('div');
  cornerDiv.className = 'grid-cell corner-cell';
  cornerDiv.style.gridRow = '1 / 2';
  cornerDiv.style.gridColumn = '1 / 2';
  cornerDiv.style.borderBottom = '1px solid #eef2f8';
  cornerDiv.style.borderRight = '1px solid #eef2f8';
  cornerDiv.style.background = '#ffffff';
  cornerDiv.innerHTML = `<div class="split-line"><div class="corner-text text-week">星期</div><div class="corner-text text-time">节次</div></div>`;
  container.appendChild(cornerDiv);
  
  // 星期标题
  for (let c = 0; c < colsCount; c++) {
    const weekCell = document.createElement('div');
    weekCell.className = 'grid-cell week-header';
    weekCell.style.gridRow = '1 / 2';
    weekCell.style.gridColumn = `${c + 2} / ${c + 3}`;
    weekCell.style.borderBottom = '1px solid #eef2f8';
    weekCell.style.borderRight = c === colsCount-1 ? 'none' : '1px solid #eef2f8';
    weekCell.innerText = weeks[c];
    container.appendChild(weekCell);
  }
  
  // 时间轴 + 课程格子
  for (let row = 0; row < rowsCount; row++) {
    const sectionIdx = row;
    const sectionNum = sectionIdx + 1;
    const timeItem = timeConfig[sectionIdx];
    const timeCell = document.createElement('div');
    timeCell.className = 'grid-cell time-header-cell';
    timeCell.style.gridRow = `${row + 2} / ${row + 3}`;
    timeCell.style.gridColumn = '1 / 2';
    timeCell.style.borderRight = '1px solid #eef2f8';
    timeCell.style.borderBottom = (row === rowsCount-1) ? 'none' : '1px solid #eef2f8';
    timeCell.innerHTML = `<div class="time-section">${escapeHtml(timeItem.section)}</div><div class="time-detail">${escapeHtml(timeItem.time)}</div>`;
    timeCell.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTimeEditIndex = sectionIdx;
      document.getElementById('editSection').value = timeConfig[sectionIdx].section;
      document.getElementById('editTime').value = timeConfig[sectionIdx].time;
      openModal('editTimeModal');
    });
    container.appendChild(timeCell);
    
    for (let col = 0; col < colsCount; col++) {
      const weekVal = weeks[col];
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.style.gridRow = `${row + 2} / ${row + 3}`;
      cell.style.gridColumn = `${col + 2} / ${col + 3}`;
      cell.style.borderBottom = (row === rowsCount-1) ? 'none' : '1px solid #eef2f8';
      cell.style.borderRight = (col === colsCount-1) ? 'none' : '1px solid #eef2f8';
      cell.style.padding = '4px';
      cell.style.cursor = 'pointer';
      
      const course = currentWeekCourses.find(c => c.week === weekVal && Number(c.section) === sectionNum);
      if (course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `<div class="c-name">${escapeHtml(course.name)}</div><div class="c-info">${escapeHtml(course.teacher || '老师')} | ${escapeHtml(course.room)}</div>`;
        card.style.backgroundColor = course.color || '#2b6ef0';
        cell.appendChild(card);
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          handleCourseAction(course);
        });
      } else {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-cell';
        emptyDiv.innerHTML = '';
        emptyDiv.title = '点击添加课程';  // 鼠标悬停时显示提示
        cell.appendChild(emptyDiv);
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          openAddCourseModal(weekVal, sectionNum);
        });
      }
      container.appendChild(cell);
    }
  }
}

// ---------- 课程操作 ----------
function handleCourseAction(course) {
  currentViewingCourse = course;
  const weekMap = { '一':'星期一','二':'星期二','三':'星期三','四':'星期四','五':'星期五','六':'星期六','日':'星期日' };
  const weekStr = weekMap[course.week] || course.week;
  const sectionIndex = course.section;
  const sectionInfo = timeConfig[sectionIndex-1] || { section: sectionIndex, time: '' };
  const timeStr = sectionInfo.time ? ` (${sectionInfo.time})` : '';
  const infoHtml = `
    <p><strong>📖 课程名称：</strong> ${escapeHtml(course.name)}</p>
    <p><strong>👩‍🏫 授课老师：</strong> ${escapeHtml(course.teacher || '未填')}</p>
    <p><strong>🏫 教室：</strong> ${escapeHtml(course.room)}</p>
    <p><strong>📅 星期：</strong> ${weekStr}</p>
    <p><strong>⏰ 节次：</strong> ${sectionInfo.section}${timeStr}</p>
  `;
  document.getElementById('courseInfoContent').innerHTML = infoHtml;
  openModal('courseInfoModal');
}

function openAddCourseModal(week, sectionNum) {
  editingCourseId = null;
  document.getElementById('modalTitle').innerText = '添加课程';
  document.getElementById('courseForm').reset();
  document.getElementById('syncColorOption').style.display = 'none';
  document.getElementById('syncColorToAll').checked = false;
  document.getElementById('courseWeek').value = week;
  updateSectionSelectInModal();
  document.getElementById('courseSection').value = sectionNum;
  openModal('courseModal');
}

function handleAddByPlus() {
  editingCourseId = null;
  document.getElementById('modalTitle').innerText = '添加课程';
  document.getElementById('courseForm').reset();
  updateSectionSelectInModal();
  document.getElementById('courseWeek').value = '';
  document.getElementById('courseSection').value = '';
  openModal('courseModal');
}

function openEditModalForCourse(course) {
  window.originalCourseName = course.name;
  editingCourseId = course.id;
  document.getElementById('courseColor').value = course.color || '#2b6ef0';
  document.getElementById('modalTitle').innerText = '编辑课程';
  document.getElementById('courseName').value = course.name;
  document.getElementById('courseTeacher').value = course.teacher || '';
  document.getElementById('courseRoom').value = course.room;
  document.getElementById('courseWeek').value = course.week;
  document.getElementById('courseSection').value = course.section;
  document.getElementById('syncColorOption').style.display = 'block';
  document.getElementById('syncColorToAll').checked = false;
  openModal('courseModal');
}

function saveCourseFromModal(e) {
  e.preventDefault();
  const name = document.getElementById('courseName').value.trim();
  const teacher = document.getElementById('courseTeacher').value.trim() || '';
  const room = document.getElementById('courseRoom').value.trim();
  const week = document.getElementById('courseWeek').value;
  const section = document.getElementById('courseSection').value;
  if (!name || !week || !section || !room) {
    showToast('请填写完整信息 (课程名/星期/节次/教室)');
    return;
  }
  if (editingCourseId) {
    let editedColor = document.getElementById('courseColor').value;
    const index = allCourses.findIndex(c => c.id === editingCourseId);
    if (index !== -1) {
      // 冲突检测：排除当前课程自身
      const isConflict = allCourses.some(c => c.id !== editingCourseId && c.week === week && Number(c.section) === Number(section));
      if (isConflict) {
        showToast(`冲突：星期${week} 第${section}节已有其他课程，请修改时间`, 2000);
        return; // 阻止保存
      }
      allCourses[index] = { ...allCourses[index], name, teacher, room, week, section: Number(section), color: editedColor, id: editingCourseId };
      showToast('课程已更新');
    }
    if (document.getElementById('syncColorToAll').checked) {
      const targetName = window.originalCourseName;
      if (targetName) {
        allCourses.forEach(c => { if (c.name === targetName) c.color = editedColor; });
        showToast(`已将“${targetName}”的所有课程颜色统一`, 1500);
      }
    }
    delete window.originalCourseName;
  } else {
    const exist = allCourses.some(c => c.week === week && Number(c.section) === Number(section));
    if (exist) {
      showToast(`⚠️ 星期${week} 第${section}节已有课程，请先删除再添加`, 2000);
      return;
    }
    let selectedColor = document.getElementById('courseColor').value;
    if (!selectedColor) {
      const sameNameCourse = [...allCourses].reverse().find(c => c.name === name);
      selectedColor = sameNameCourse ? sameNameCourse.color : '#2b6ef0';
    }
    const newCourse = { id: Date.now(), name, teacher, room, week, section: Number(section), color: selectedColor, weekNum: currentWeek };
    allCourses.push(newCourse);
    showToast(`✅ 添加成功: ${name}`);
  }
  localStorage.setItem('myCourses', JSON.stringify(allCourses));
  closeModal('courseModal');
  renderFullTable();
}

// 自动生成时间轴
function generateTimeAxis() {
  const startTimeStr = document.getElementById('autoStartTime').value;
  const duration = parseInt(document.getElementById('autoDuration').value);
  const breakMin = parseInt(document.getElementById('autoBreak').value);
  const sectionCount = parseInt(document.getElementById('autoSectionCount').value);   // 新增：读取节次数
  
  if (!startTimeStr || isNaN(duration) || isNaN(breakMin) || isNaN(sectionCount) || duration <= 0 || sectionCount < 1) {
    showToast('请正确填写所有参数', 1500);
    return;
  }
  
  const [startHour, startMin] = startTimeStr.split(':').map(Number);
  let currentMinute = startHour * 60 + startMin;
  const newTimeConfig = [];
  
  for (let i = 0; i < sectionCount; i++) {   // 修改：循环次数改为用户输入的 sectionCount
    const startMins = currentMinute;
    const endMins = currentMinute + duration;
    const startTime = formatTime(startMins);
    const endTime = formatTime(endMins);
    newTimeConfig.push({
      section: `第${i+1}节`,
      time: `${startTime}-${endTime}`
    });
    if (i < sectionCount - 1) {              // 修改：边界条件同步调整
      currentMinute = endMins + breakMin;
    }
  }
  
  timeConfig.length = 0;
  timeConfig.push(...newTimeConfig);
  localStorage.setItem('courseTimeConfig', JSON.stringify(timeConfig));
  renderTimeConfigPanel();
  renderFullTable();
  showToast(`已生成 ${sectionCount} 个节次的时间轴`, 1500);   // 修改：提示信息包含节次数
}

// 辅助函数：将分钟数转换为 HH:MM 格式（两位数）
function formatTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function handleTimeEdit(e) {
  e.preventDefault();
  if (currentTimeEditIndex === -1) return;
  const newSection = document.getElementById('editSection').value.trim();
  const newTime = document.getElementById('editTime').value.trim();
  if (!newSection || !newTime) {
    showToast('节次名称和时间不能为空');
    return;
  }
  timeConfig[currentTimeEditIndex] = { section: newSection, time: newTime };
  localStorage.setItem('courseTimeConfig', JSON.stringify(timeConfig));
  renderFullTable();
  closeModal('editTimeModal');
  showToast('时间轴已更新');
}

function autoMatchColor() {
  const name = document.getElementById('courseName').value.trim();
  if (!name) return;
  const matchedCourses = allCourses.filter(c => c.name === name);
  if (matchedCourses.length > 0) {
    const lastCourse = matchedCourses[matchedCourses.length - 1];
    if (lastCourse.color) {
      document.getElementById('courseColor').value = lastCourse.color;
      showToast(`已自动匹配“${name}”的颜色`, 1200);
    }
  }
}

function timeToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

// ---------- 事件绑定 ----------
function bindGlobalEvents() {
    document.getElementById('addTimeSlotBtn').addEventListener('click', () => {
      const newIndex = timeConfig.length + 1;
      timeConfig.push({ section: `第${newIndex}节`, time: "00:00-00:00" });
      localStorage.setItem('courseTimeConfig', JSON.stringify(timeConfig));
      renderTimeConfigPanel();
      renderFullTable();
      showToast(`已添加第${newIndex}节`, 1000);
    });
    document.getElementById('generateTimeAxisBtn').addEventListener('click', generateTimeAxis);

    document.getElementById('toggleTimeConfigBtn').addEventListener('click', () => {
      const panel = document.getElementById('timeConfigPanel');
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        renderTimeConfigPanel(); // 展开时刷新列表（确保数据最新）
      }
    });

    // 学期下拉框切换事件
    const semesterSelect = document.getElementById('semesterSelect');
    if (semesterSelect) {
      semesterSelect.addEventListener('change', (e) => {
        switchSemester(e.target.value);
      });
    }

    // 添加学期按钮
    const addSemesterBtn = document.getElementById('addSemesterBtn');
    if (addSemesterBtn) {
      addSemesterBtn.addEventListener('click', () => {
        let newId = prompt('请输入学期ID（英文或数字，如2025-1）');
        if (!newId) return;
        while (semesters[newId]) {
          newId = prompt('ID已存在，请重新输入');
          if (!newId) return;
        }
    const newName = prompt('请输入学期显示名称', newId);
    if (!newName) return;
    semesters[newId] = {
      name: newName,
      courses: [],
      timeConfig: JSON.parse(JSON.stringify(DEFAULT_TIME_CONFIG)),
      maxWeek: 20,
      currentWeek: 1
    };
    saveSemesters();
    refreshSemesterSelect();
    switchSemester(newId);
  });
}

// 删除学期按钮
const deleteSemesterBtn = document.getElementById('deleteSemesterBtn');
if (deleteSemesterBtn) {
  deleteSemesterBtn.addEventListener('click', () => {
    if (Object.keys(semesters).length === 1) {
      showToast('至少保留一个学期', 1500);
      return;
    }
    if (confirm(`确定删除学期“${semesters[currentSemesterId].name}”吗？该学期所有课程将被删除。`)) {
      delete semesters[currentSemesterId];
      const newId = Object.keys(semesters)[0];
      saveSemesters();
      refreshSemesterSelect();
      switchSemester(newId);
    }
  });
}

const addNewCourseBtn = document.getElementById('addNewCourseBtn');
  if (addNewCourseBtn) {
    addNewCourseBtn.addEventListener('click', quickAddCourse);
  }
    // 添加课程按钮
    document.getElementById('addBtn').addEventListener('click', () => handleAddByPlus());

    // 设置按钮：打开全屏设置视图
    document.getElementById('settingBtn').addEventListener('click', () => {
        document.getElementById('panelTotalWeeks').value = MAX_WEEK;
        renderFullSettingsPanel();
        renderTimeConfigPanel();
        document.getElementById('generateTimeAxisBtn').addEventListener('click', generateTimeAxis);
        document.querySelector('.app-container').style.display = 'none';
        document.getElementById('fullSettingsView').style.display = 'block';
    });

    // 编辑课程详情弹窗中的按钮
    document.getElementById('editFromInfoBtn').addEventListener('click', () => {
        if (currentViewingCourse) {
            closeModal('courseInfoModal');
            openEditModalForCourse(currentViewingCourse);
        }
    });
    document.getElementById('deleteFromInfoBtn').addEventListener('click', () => {
      if (currentViewingCourse && confirm(`确定删除课程“${currentViewingCourse.name}”吗？`)) {
        // 直接操作 semesters 对象
        const semester = semesters[currentSemesterId];
        semester.courses = semester.courses.filter(c => c.id !== currentViewingCourse.id);
        saveSemesters(); // 保存到 localStorage
        
        // 刷新所有相关视图
        renderFullTable();
        // 如果全局设置面板打开，刷新它
        const settingsView = document.getElementById('fullSettingsView');
        if (settingsView && settingsView.style.display === 'block') {
          renderFullSettingsPanel();
          renderTimeConfigPanel(); // 如果有时间轴面板也刷新
        }
        showToast(`已删除 ${currentViewingCourse.name}`);
        closeModal('courseInfoModal');
        currentViewingCourse = null;
      }
    });

    // 关闭其他弹窗的按钮
    document.getElementById('closeCourseModalBtn').addEventListener('click', () => closeModal('courseModal'));
    document.getElementById('cancelEditTimeBtn').addEventListener('click', () => closeModal('editTimeModal'));
    document.getElementById('closeInfoModalBtn').addEventListener('click', () => {
        closeModal('courseInfoModal');
        currentViewingCourse = null;
    });

    // 表单提交
    document.getElementById('courseForm').addEventListener('submit', saveCourseFromModal);
    document.getElementById('timeForm').addEventListener('submit', handleTimeEdit);

    // 点击模态背景关闭
    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
            if (e.target.id === 'courseModal') editingCourseId = null;
            if (e.target.id === 'courseInfoModal') currentViewingCourse = null;
        }
    });

    // 周次切换按钮
    const prevBtn = document.getElementById('prevWeekBtn');
    const nextBtn = document.getElementById('nextWeekBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentWeek > 1) { currentWeek--; updateTopDate(); renderFullTable(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (currentWeek < MAX_WEEK) { currentWeek++; updateTopDate(); renderFullTable(); } });

    // 全屏设置视图：返回按钮
    document.getElementById('backFromSettingsBtn').addEventListener('click', () => {
        document.getElementById('fullSettingsView').style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
    });

    // 全屏设置视图：保存按钮
    document.getElementById('panelSaveSettingsBtn').addEventListener('click', saveFullSettings);
}


function createScheduleRow(groupName, scheduleData = null) {
  const row = document.createElement('div');
  row.className = 'schedule-row';
  row.style.cssText = 'display:flex; gap:8px; margin-top:8px; align-items:center;';
  
  if (scheduleData && scheduleData.id) {
    row.setAttribute('data-schedule-id', scheduleData.id);
  }
  
  // 星期下拉
  const weekSelect = document.createElement('select');
  weekSelect.className = 'form-select schedule-week';
  weekSelect.style.flex = '1';
  weeks.forEach(w => {
    const option = document.createElement('option');
    option.value = w;
    option.textContent = `星期${w}`;
    if (scheduleData && scheduleData.week === w) option.selected = true;
    weekSelect.appendChild(option);
  });
  
  // 节次下拉
  const sectionSelect = document.createElement('select');
  sectionSelect.className = 'form-select schedule-section';
  sectionSelect.style.flex = '1';
  sectionSelect.innerHTML = '<option value="">请选择节次</option>';
  timeConfig.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = idx + 1;
    opt.textContent = `${item.section} (${item.time})`;
    if (scheduleData && scheduleData.section === idx+1) opt.selected = true;
    sectionSelect.appendChild(opt);
  });
  
  // 教室输入框
  const roomInput = document.createElement('input');
  roomInput.type = 'text';
  roomInput.className = 'form-input schedule-room';
  roomInput.placeholder = '教室';
  roomInput.style.flex = '2';
  roomInput.value = scheduleData ? (scheduleData.room || '') : '';
  
  // 删除按钮
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'remove-schedule-btn unified-btn';
  delBtn.textContent = '删除';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('确定删除该课时吗？')) {
      row.remove();
    }
  });
  
  row.appendChild(weekSelect);
  row.appendChild(sectionSelect);
  row.appendChild(roomInput);
  row.appendChild(delBtn);
  
  return row;
}

function saveFullSettings() {
  // 保存学期总周数
  const newTotal = parseInt(document.getElementById('panelTotalWeeks').value);
  if (!isNaN(newTotal) && newTotal >= 1) {
    MAX_WEEK = newTotal;
    localStorage.setItem('totalWeeks', MAX_WEEK);
    if (currentWeek > MAX_WEEK) currentWeek = 1;
    updateTopDate();
  }

  // 从全屏视图的课程分组容器中收集数据
  const container = document.getElementById('panelCourseGroupsContainer');
  if (!container) return;
  const groupDivs = container.querySelectorAll('.course-group');
  const newCourses = [];
  let hasError = false;

  groupDivs.forEach(groupDiv => {
    const name = groupDiv.querySelector('strong')?.innerText || '';
    const teacher = groupDiv.querySelector('.group-teacher')?.value || '';
    const color = groupDiv.querySelector('.group-color')?.value || '#2b6ef0';
    const startWeek = parseInt(groupDiv.querySelector('.group-start-week')?.value) || 1;
    const endWeek = parseInt(groupDiv.querySelector('.group-end-week')?.value) || MAX_WEEK;
    const weekType = groupDiv.querySelector('.group-weektype')?.value || 'all';
    const scheduleRows = groupDiv.querySelectorAll('.schedule-row');
    scheduleRows.forEach(row => {
      const week = row.querySelector('.schedule-week')?.value;
      const section = row.querySelector('.schedule-section')?.value;
      const room = row.querySelector('.schedule-room')?.value.trim();
      if (!week || !section || !room) {
        showToast(`课程“${name}”存在不完整的课时，请填写完整后再保存`, 2000);
        hasError = true;
        return;
      }
      const oldId = row.getAttribute('data-schedule-id');
      const id = oldId && oldId !== 'null' ? parseInt(oldId) : Date.now() + Math.random() * 10000;
      newCourses.push({
        id: id,
        name: name,
        teacher: teacher,
        color: color,
        week: week,
        section: Number(section),
        room: room,
        startWeek: startWeek,
        endWeek: endWeek,
        weekType: weekType,
        weekNum: currentWeek
      });
    });
  });

  if (hasError) return;

  allCourses = newCourses;
  localStorage.setItem('myCourses', JSON.stringify(allCourses));
  renderFullTable();
  renderFullSettingsPanel();  // 刷新当前视图
  showToast('保存成功', 1500);
}

function refreshSemesterSelect() {
  const select = document.getElementById('semesterSelect');
  if (!select) return;
  select.innerHTML = '';
  for (const id in semesters) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = semesters[id].name;
    if (id === currentSemesterId) option.selected = true;
    select.appendChild(option);
  }
}

function switchSemester(semesterId) {
  if (!semesters[semesterId]) return;
  currentSemesterId = semesterId;
  localStorage.setItem('currentSemesterId', currentSemesterId);
  updateTopDate();
  updateSectionSelectInModal();
  renderFullTable();
  const settingsView = document.getElementById('fullSettingsView');
  if (settingsView && settingsView.style.display === 'block') {
    renderFullSettingsPanel();
    renderTimeConfigPanel();
  }
  refreshSemesterSelect();
  showToast(`已切换到 ${semesters[currentSemesterId].name}`, 1500);
}

function renderTimeConfigPanel() {
  const container = document.getElementById('timeConfigList');
  if (!container) return;
  container.innerHTML = '';
  timeConfig.forEach((item, index) => {
    const [start, end] = item.time.split('-');
    const row = document.createElement('div');
    row.className = 'time-config-row';
    row.style.cssText = 'display: flex; gap: 12px; align-items: center; margin-bottom: 8px;';
    row.innerHTML = `
      <span style="width: 60px;">第${index+1}节</span>
      <div style="display: flex; gap: 8px; flex: 2;">
        <input type="text" class="form-input time-start" value="${escapeHtml(start || '')}" placeholder="开始" style="flex: 1;">
        <span style="line-height: 36px;">–</span>
        <input type="text" class="form-input time-end" value="${escapeHtml(end || '')}" placeholder="结束" style="flex: 1;">
      </div>
      <button class="remove-time-btn unified-btn" style="background: #fde2e2; padding: 4px 12px;">删除</button>
    `;
    container.appendChild(row);
    const startInput = row.querySelector('.time-start');
    const endInput = row.querySelector('.time-end');
    const removeBtn = row.querySelector('.remove-time-btn');

    // 初始化 flatpickr
    flatpickr(startInput, {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      onClose: () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(updateTime, 200);
      }
    });
    flatpickr(endInput, {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      onClose: () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(updateTime, 200);
      }
    });

    let saveTimeout;
    const updateTime = () => {
      const startVal = startInput.value;
      const endVal = endInput.value;
      if (!startVal || !endVal) return;

      // 校验开始 < 结束
      if (timeToMinutes(startVal) >= timeToMinutes(endVal)) {
        showToast(`第${index+1}节：开始时间必须早于结束时间`, 2000);
        // 恢复原值
        const [oldStart, oldEnd] = item.time.split('-');
        startInput.value = oldStart;
        endInput.value = oldEnd;
        return;
      }

      // 与前一个节次比较
      if (index > 0) {
        const prevTime = timeConfig[index-1].time;
        const prevEnd = prevTime.split('-')[1];
        if (timeToMinutes(startVal) < timeToMinutes(prevEnd)) {
          showToast(`第${index+1}节的开始时间不能早于第${index}节的结束时间（${prevEnd}）`, 2500);
          const [oldStart, oldEnd] = item.time.split('-');
          startInput.value = oldStart;
          endInput.value = oldEnd;
          return;
        }
      }

      // 与后一个节次比较
      if (index < timeConfig.length - 1) {
        const nextTime = timeConfig[index+1].time;
        const nextStart = nextTime.split('-')[0];
        if (timeToMinutes(endVal) > timeToMinutes(nextStart)) {
          showToast(`第${index+1}节的结束时间不能晚于第${index+2}节的开始时间（${nextStart}）`, 2500);
          const [oldStart, oldEnd] = item.time.split('-');
          startInput.value = oldStart;
          endInput.value = oldEnd;
          return;
        }
      }

      // 保存
      timeConfig[index].time = `${startVal}-${endVal}`;
      localStorage.setItem('courseTimeConfig', JSON.stringify(timeConfig));
      renderFullTable();
      showToast(`节次 ${index+1} 时间已更新`, 1000);
      startInput.blur();
      endInput.blur();
    };

    removeBtn.addEventListener('click', () => {
      if (timeConfig.length === 1) {
        showToast('至少保留一个节次', 1000);
        return;
      }
      if (confirm(`确定删除第${index+1}节吗？`)) {
        timeConfig.splice(index, 1);
        timeConfig.forEach((item, idx) => { item.section = `第${idx+1}节`; });
        localStorage.setItem('courseTimeConfig', JSON.stringify(timeConfig));
        renderTimeConfigPanel();
        renderFullTable();
        showToast('节次已删除', 1000);
      }
    });
  });
}


// 获取分组后的课程数据（用于渲染）
function getCourseGroups() {
  const courses = semesters[currentSemesterId].courses;
  const groups = new Map();
  allCourses.forEach(course => {
    const name = course.name;
    if (!groups.has(name)) {
      groups.set(name, {
        name: name,
        teacher: course.teacher,
        color: course.color,
        startWeek: course.startWeek !== undefined ? course.startWeek : 1,
        endWeek: course.endWeek !== undefined ? course.endWeek : MAX_WEEK,
        weekType: course.weekType !== undefined ? course.weekType : 'all',
        schedules: []
      });
    }
    const group = groups.get(name);
    // 避免重复添加同一课时（根据id）
    if (!group.schedules.some(s => s.id === course.id)) {
      group.schedules.push({
        id: course.id,
        week: course.week,
        section: course.section,
        room: course.room,
      });
    }
  });
  return Array.from(groups.values());
}


// 渲染全屏设置视图中的课程分组列表
function renderFullSettingsPanel() {
  const container = document.getElementById('panelCourseGroupsContainer');
  if (!container) return;
  const groups = getCourseGroups();
  if (groups.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#888;">暂无课程，请返回课表添加。</p>';
    return;
  }
  container.innerHTML = '';
  groups.forEach((group) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'course-group';
    groupDiv.style.cssText = 'border:1px solid #eef2f8; border-radius:16px; padding:16px; margin-bottom:20px; background:#fff;';
    groupDiv.setAttribute('data-group-name', group.name);
    groupDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <strong style="font-size:18px;">${escapeHtml(group.name)}</strong>
        <button type="button" class="remove-group-btn unified-btn">删除课程</button>
      </div>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
        <label style="flex: 0 0 auto;">教师</label>
        <input type="text" class="form-input group-teacher" style="flex: 2; min-width: 80px;">
        <label style="flex: 0 0 auto;">颜色</label>
        <input type="color" class="form-input group-color" value="${group.color || '#2b6ef0'}" style="flex: 1; min-width: 50px;">
        <label style="flex: 0 0 auto;">起始周</label>
        <input type="number" class="form-input group-start-week" style="flex: 1; width: 70px;">
        <label style="flex: 0 0 auto;">结束周</label>
        <input type="number" class="form-input group-end-week" style="flex: 1; width: 70px;">
        <label style="flex: 0 0 auto;">单双周</label>
        <select class="form-input group-weektype" style="flex: 1; min-width: 70px;">
          <option value="all" ${group.weekType === 'all' ? 'selected' : ''}>每周</option>
          <option value="odd" ${group.weekType === 'odd' ? 'selected' : ''}>单周</option>
          <option value="even" ${group.weekType === 'even' ? 'selected' : ''}>双周</option>
        </select>
      </div>
      <div>
        <strong>课时列表</strong>
        <div class="schedules-list" data-group-name="${group.name}"></div>
        <button type="button" class="add-schedule-btn unified-btn" style="margin-top: 16px;">+ 添加课时</button>
      </div>
    `;
    container.appendChild(groupDiv);

    const schedulesContainer = groupDiv.querySelector('.schedules-list');
    group.schedules.forEach(schedule => {
      const scheduleRow = createScheduleRow(group.name, schedule);
      schedulesContainer.appendChild(scheduleRow);
    });

    groupDiv.querySelector('.add-schedule-btn').addEventListener('click', () => {
      const newRow = createScheduleRow(group.name, null);
      schedulesContainer.appendChild(newRow);
    });

    groupDiv.querySelector('.remove-group-btn').addEventListener('click', () => {
      if (confirm(`确定删除课程“${group.name}”的所有课时吗？`)) {
        // 1. 从数据中删除所有该课程名的课时
        allCourses = allCourses.filter(c => c.name !== group.name);
        // 2. 保存到 localStorage
        saveSemesters();
        // 3. 移除 DOM 元素
        groupDiv.remove();
        // 4. 刷新主课表
        renderFullTable();
        showToast(`已删除课程“${group.name}”`, 1500);
      }
    });
  });
}

// ---------- 初始化 ----------
function init() {
  const savedSemesters = localStorage.getItem('semesters');
  if (savedSemesters) {
    semesters = JSON.parse(savedSemesters);
    currentSemesterId = localStorage.getItem('currentSemesterId') || Object.keys(semesters)[0];
  } else {
    // 迁移旧数据
    const oldCourses = JSON.parse(localStorage.getItem('myCourses')) || [];
    const oldTimeConfig = JSON.parse(localStorage.getItem('courseTimeConfig')) || DEFAULT_TIME_CONFIG;
    const oldMaxWeek = parseInt(localStorage.getItem('totalWeeks')) || 20;
    const defaultId = 'default';
    semesters[defaultId] = {
      name: '默认学期',
      courses: oldCourses.map(c => ({
        ...c,
        startWeek: c.startWeek !== undefined ? c.startWeek : 1,
        endWeek: c.endWeek !== undefined ? c.endWeek : oldMaxWeek,
        weekType: c.weekType !== undefined ? c.weekType : 'all',
        id: c.id || Date.now() + Math.random()
      })),
      timeConfig: oldTimeConfig,
      maxWeek: oldMaxWeek,
      currentWeek: 1
    };
    currentSemesterId = defaultId;
    saveSemesters();
    // 清除旧数据
    localStorage.removeItem('myCourses');
    localStorage.removeItem('courseTimeConfig');
    localStorage.removeItem('totalWeeks');
  }

  // 确保当前学期有效
  if (!semesters[currentSemesterId]) {
    currentSemesterId = Object.keys(semesters)[0];
  }

  // 刷新学期下拉框
  refreshSemesterSelect();

  updateTopDate();
  updateSectionSelectInModal();
  renderFullTable();
  bindGlobalEvents();
}

init();