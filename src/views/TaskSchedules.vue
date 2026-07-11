<template>
  <div class="task-schedules-page">
    <div class="page-shell">
      <div class="page-header">
        <div>
          <h1>后端定时任务</h1>
          <p>配置后端常驻 Worker 定时登录游戏并执行任务。</p>
        </div>
        <n-space>
          <n-button secondary :loading="loading" @click="loadAll">刷新</n-button>
          <n-button type="primary" @click="resetForm">新建任务</n-button>
        </n-space>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">任务总数</span>
          <strong>{{ schedules.length }}</strong>
        </div>
        <div class="summary-item success">
          <span class="summary-label">已启用</span>
          <strong>{{ enabledCount }}</strong>
        </div>
        <div class="summary-item failed">
          <span class="summary-label">最近失败</span>
          <strong>{{ failedCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">下次执行</span>
          <strong>{{ nextRunText }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Worker 扫描</span>
          <strong>{{ schedulerScanText }}</strong>
        </div>
      </div>

      <div class="schedule-layout">
        <section class="config-panel">
          <div class="section-title">
            <h2>{{ editingId ? "编辑任务" : "创建任务" }}</h2>
          </div>

          <n-form label-placement="top" :disabled="saving">
            <n-form-item label="游戏 Token">
              <n-select
                v-model:value="form.tokenIds"
                multiple
                filterable
                placeholder="可选择多个后端保存的 Token"
                :options="tokenOptions"
              />
            </n-form-item>

            <n-form-item label="任务选择">
              <n-checkbox-group v-model:value="form.selectedTasks" class="task-picker">
                <n-tabs v-model:value="activeGroup" type="line" animated>
                  <n-tab-pane
                    v-for="group in taskGroups"
                    :key="group.name"
                    :name="group.name"
                    :tab="group.label"
                  >
                    <div class="task-grid">
                      <n-checkbox
                        v-for="task in tasksByGroup[group.name] || []"
                        :key="task.value"
                        :value="task.value"
                      >
                        {{ task.label }}
                      </n-checkbox>
                    </div>
                  </n-tab-pane>
                </n-tabs>
              </n-checkbox-group>
            </n-form-item>

            <n-form-item label="计划类型">
              <n-radio-group v-model:value="form.scheduleMode">
                <n-radio-button value="daily">每天固定时间</n-radio-button>
                <n-radio-button value="hourly">每 N 小时</n-radio-button>
                <n-radio-button value="cron">Cron 表达式</n-radio-button>
              </n-radio-group>
            </n-form-item>

            <n-form-item v-if="form.scheduleMode === 'daily'" label="每天执行时间">
              <n-time-picker
                v-model:formatted-value="form.runTime"
                format="HH:mm"
                value-format="HH:mm"
                clearable
                class="full-control"
              />
            </n-form-item>

            <n-form-item v-else-if="form.scheduleMode === 'hourly'" label="执行间隔">
              <n-input-number
                v-model:value="form.intervalHours"
                :min="1"
                :max="24"
                class="full-control"
              >
                <template #suffix>小时</template>
              </n-input-number>
            </n-form-item>

            <n-form-item v-else label="Cron 表达式">
              <n-input
                v-model:value="form.cronExpression"
                placeholder="例如：30 9 * * *"
              />
            </n-form-item>

            <n-form-item label="随机抖动">
              <n-input-number
                v-model:value="form.jitterMinutes"
                :min="0"
                :max="120"
                class="full-control"
              >
                <template #suffix>分钟</template>
              </n-input-number>
            </n-form-item>

            <n-form-item label="启用状态">
              <n-switch v-model:value="form.enabled">
                <template #checked>启用</template>
                <template #unchecked>停用</template>
              </n-switch>
            </n-form-item>

            <n-space>
              <n-button type="primary" :loading="saving" @click="saveSchedule">
                {{ editingId ? "保存修改" : "创建任务" }}
              </n-button>
              <n-button secondary @click="resetForm">重置</n-button>
            </n-space>
          </n-form>
        </section>

        <section class="list-panel">
          <div class="section-title">
            <h2>任务列表</h2>
            <n-button text type="primary" @click="goLogs()">查看全部日志</n-button>
          </div>

          <n-alert v-if="error" type="error" class="state-alert">
            {{ error }}
          </n-alert>

          <div v-if="loading && schedules.length === 0" class="state-panel">
            <n-spin />
            <span>正在读取后端定时任务...</span>
          </div>

          <n-empty
            v-else-if="schedules.length === 0"
            class="state-panel"
            description="还没有后端定时任务"
          />

          <div v-else class="schedule-list">
            <article v-for="task in schedules" :key="task.id" class="schedule-item">
              <div class="schedule-main">
                <div class="schedule-title">
                  <n-tag :type="task.enabled ? 'success' : 'default'" size="small">
                    {{ task.enabled ? "启用" : "停用" }}
                  </n-tag>
                  <strong>{{ scheduleTitle(task) }}</strong>
                  <span class="muted">#{{ task.id }}</span>
                </div>
                <div class="schedule-meta">
                  <span>{{ tokenName(task.token_id) }}</span>
                  <span>{{ cronLabel(task.cron_expression) }}</span>
                  <span>下次 {{ formatDate(task.next_run_at) }}</span>
                  <span>上次 {{ formatDate(task.last_run_at) }}</span>
                </div>
                <div class="result-line">
                  <span>任务：{{ selectedTaskSummary(task) }}</span>
                </div>
                <div class="result-line">
                  <span>最近结果：{{ resultLabel(task.last_result) }}</span>
                  <span v-if="task.last_error" class="error-text">{{ task.last_error }}</span>
                </div>
              </div>
              <n-space class="action-row">
                <n-switch
                  :value="task.enabled"
                  size="small"
                  :loading="actionId === task.id"
                  @update:value="toggleEnabled(task, $event)"
                />
                <n-button size="small" secondary @click="editTask(task)">编辑</n-button>
                <n-button
                  size="small"
                  type="primary"
                  secondary
                  :loading="actionId === task.id"
                  @click="runNow(task)"
                >
                  立即执行
                </n-button>
                <n-button size="small" secondary @click="goLogs(task)">日志</n-button>
                <n-popconfirm @positive-click="deleteTask(task)">
                  <template #trigger>
                    <n-button size="small" type="error" secondary>删除</n-button>
                  </template>
                  删除这个后端定时任务？
                </n-popconfirm>
              </n-space>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useMessage } from "naive-ui";
import { useRouter } from "vue-router";
import { tasksApi } from "@/api/tasks";
import { tokensApi } from "@/api/tokens";

const message = useMessage();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const actionId = ref(null);
const error = ref("");
const tokens = ref([]);
const schedules = ref([]);
const schedulerStatus = ref(null);
const editingId = ref(null);
const taskDefinitions = ref([]);
const taskGroups = ref([]);
const activeGroup = ref("daily");

const form = reactive({
  tokenIds: [],
  selectedTasks: ["startBatch"],
  scheduleMode: "daily",
  runTime: "09:00",
  intervalHours: 4,
  cronExpression: "0 9 * * *",
  jitterMinutes: 0,
  enabled: true,
});

const uniqueTokens = computed(() => {
  const map = new Map();
  tokens.value.forEach((token) => {
    const key = `${token.name || ""}::${token.server || ""}`;
    const current = map.get(key);
    const tokenTime = new Date(token.last_connected_at || token.created_at || 0).getTime();
    const currentTime = current
      ? new Date(current.last_connected_at || current.created_at || 0).getTime()
      : -1;
    if (!current || tokenTime >= currentTime) {
      map.set(key, token);
    }
  });
  return Array.from(map.values());
});

const tokenOptions = computed(() =>
  uniqueTokens.value.map((token) => ({
    label: [token.name, token.server].filter(Boolean).join(" · ") || `Token #${token.id}`,
    value: token.id,
  })),
);

const taskMap = computed(() => {
  const map = {};
  taskDefinitions.value.forEach((task) => {
    map[task.value] = task;
  });
  return map;
});

const tasksByGroup = computed(() => {
  const grouped = {};
  taskDefinitions.value.forEach((task) => {
    const group = task.group || "other";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(task);
  });
  return grouped;
});

const enabledCount = computed(() => schedules.value.filter((task) => task.enabled).length);
const failedCount = computed(
  () => schedules.value.filter((task) => task.last_result === "failed").length,
);
const nextRunText = computed(() => {
  const next = schedules.value
    .map((task) => task.next_run_at)
    .filter(Boolean)
    .sort()[0];
  return next ? formatDate(next) : "-";
});
const schedulerScanText = computed(() => {
  const lastScanAt = schedulerStatus.value?.lastScanAt;
  return lastScanAt ? formatDate(lastScanAt) : "-";
});

const dailyTimeToCron = (time) => {
  const [hour, minute] = String(time || "").split(":").map((part) => Number(part));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "";
  return `${minute} ${hour} * * *`;
};

const cronToDailyTime = (cron) => {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return "";
  const [minute, hour, day, month, week] = parts;
  if (day !== "*" || month !== "*" || week !== "*") return "";
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const cronToHourly = (cron) => {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, day, month, week] = parts;
  const match = hour.match(/^\*\/(\d+)$/);
  if (minute === "0" && match && day === "*" && month === "*" && week === "*") {
    return Number(match[1]);
  }
  return null;
};

const currentCron = () => {
  if (form.scheduleMode === "daily") return dailyTimeToCron(form.runTime);
  if (form.scheduleMode === "hourly") return `0 */${Number(form.intervalHours || 1)} * * *`;
  return String(form.cronExpression || "").trim();
};

const loadDefinitions = async () => {
  const definitions = await tasksApi.getDefinitions();
  taskDefinitions.value = definitions.taskTypes || [];
  taskGroups.value = definitions.groups || [];
  if (!taskGroups.value.find((group) => group.name === activeGroup.value)) {
    activeGroup.value = taskGroups.value[0]?.name || "daily";
  }
};

const loadTokens = async () => {
  tokens.value = await tokensApi.getTokens();
  if (form.tokenIds.length === 0 && uniqueTokens.value[0]) {
    form.tokenIds = [uniqueTokens.value[0].id];
  }
};

const loadSchedules = async () => {
  schedules.value = await tasksApi.getTasks();
};

const loadSchedulerStatus = async () => {
  schedulerStatus.value = await tasksApi.getSchedulerStatus();
};

const loadAll = async () => {
  loading.value = true;
  error.value = "";
  try {
    await Promise.all([loadDefinitions(), loadTokens(), loadSchedules(), loadSchedulerStatus()]);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || "读取后端定时任务失败";
    message.error(error.value);
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  editingId.value = null;
  form.tokenIds = uniqueTokens.value[0] ? [uniqueTokens.value[0].id] : [];
  form.selectedTasks = ["startBatch"];
  form.scheduleMode = "daily";
  form.runTime = "09:00";
  form.intervalHours = 4;
  form.cronExpression = "0 9 * * *";
  form.jitterMinutes = 0;
  form.enabled = true;
};

const validateForm = () => {
  if (form.tokenIds.length === 0) return "请选择 Token";
  if (form.selectedTasks.length === 0) return "请至少选择一个任务";
  const cron = currentCron();
  if (!cron || cron.split(/\s+/).length !== 5) return "请输入有效的 5 段 Cron 表达式";
  return "";
};

const buildPayload = (tokenId) => ({
  tokenId,
  taskType: form.selectedTasks.length === 1 ? form.selectedTasks[0] : "task_group",
  cronExpression: currentCron(),
  timeJitterMs: Math.max(0, Number(form.jitterMinutes || 0)) * 60 * 1000,
  settings: {
    selectedTasks: [...form.selectedTasks],
    scheduleMode: form.scheduleMode,
    intervalHours: form.scheduleMode === "hourly" ? Number(form.intervalHours || 1) : undefined,
  },
});

const saveSchedule = async () => {
  const invalid = validateForm();
  if (invalid) {
    message.warning(invalid);
    return;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      const payload = buildPayload(form.tokenIds[0]);
      await tasksApi.updateTask(editingId.value, {
        enabled: form.enabled,
        cronExpression: payload.cronExpression,
        timeJitterMs: payload.timeJitterMs,
        settings: payload.settings,
      });
      message.success("后端定时任务已更新");
    } else {
      const createdTasks = [];
      for (const tokenId of form.tokenIds) {
        const created = await tasksApi.createTask(buildPayload(tokenId));
        createdTasks.push(created);
        if (form.enabled === false) {
          await tasksApi.updateTask(created.id, { enabled: false });
        }
      }
      message.success(`已创建 ${createdTasks.length} 个后端定时任务`);
    }

    resetForm();
    await loadSchedules();
  } catch (err) {
    message.error(err?.response?.data?.message || err?.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

const editTask = (task) => {
  editingId.value = task.id;
  form.tokenIds = [task.token_id];
  form.selectedTasks = task.settings?.selectedTasks?.length
    ? [...task.settings.selectedTasks]
    : [task.task_type];
  const hourly = cronToHourly(task.cron_expression);
  const time = cronToDailyTime(task.cron_expression);
  form.scheduleMode = hourly ? "hourly" : time ? "daily" : "cron";
  form.runTime = time || "09:00";
  form.intervalHours = hourly || 4;
  form.cronExpression = task.cron_expression || "0 9 * * *";
  form.jitterMinutes = Math.round(Number(task.time_jitter_ms || 0) / 60000);
  form.enabled = Boolean(task.enabled);
};

const toggleEnabled = async (task, enabled) => {
  actionId.value = task.id;
  try {
    await tasksApi.updateTask(task.id, { enabled });
    message.success(enabled ? "任务已启用" : "任务已停用");
    await loadSchedules();
  } catch (err) {
    message.error(err?.response?.data?.message || err?.message || "状态更新失败");
  } finally {
    actionId.value = null;
  }
};

const runNow = async (task) => {
  actionId.value = task.id;
  try {
    await tasksApi.runNow(task.id);
    message.success("已提交立即执行");
    await loadSchedules();
  } catch (err) {
    message.error(err?.response?.data?.message || err?.message || "提交执行失败");
  } finally {
    actionId.value = null;
  }
};

const deleteTask = async (task) => {
  actionId.value = task.id;
  try {
    await tasksApi.deleteTask(task.id);
    message.success("任务已删除");
    if (editingId.value === task.id) resetForm();
    await loadSchedules();
  } catch (err) {
    message.error(err?.response?.data?.message || err?.message || "删除失败");
  } finally {
    actionId.value = null;
  }
};

const goLogs = (task) => {
  router.push({
    path: "/admin/task-logs",
    query: task ? { tokenId: task.token_id, taskConfigId: task.id } : {},
  });
};

const tokenName = (tokenId) => {
  const token = tokens.value.find((item) => item.id === tokenId);
  return token ? [token.name, token.server].filter(Boolean).join(" · ") : `Token #${tokenId}`;
};

const selectedTaskValues = (task) =>
  task.settings?.selectedTasks?.length ? task.settings.selectedTasks : [task.task_type];

const selectedTaskSummary = (task) => {
  const labels = selectedTaskValues(task).map((value) => taskMap.value[value]?.label || value);
  if (labels.length <= 3) return labels.join("、");
  return `${labels.slice(0, 3).join("、")} 等 ${labels.length} 项`;
};

const scheduleTitle = (task) => {
  const count = selectedTaskValues(task).length;
  return count > 1 ? `任务组（${count}项）` : selectedTaskSummary(task);
};

const cronLabel = (cron) => {
  const hourly = cronToHourly(cron);
  if (hourly) return `每 ${hourly} 小时`;
  const daily = cronToDailyTime(cron);
  if (daily) return `每天 ${daily}`;
  return `Cron ${cron}`;
};

const resultLabel = (result) => {
  if (result === "success") return "成功";
  if (result === "failed") return "失败";
  return "暂无";
};

const formatDate = (value) => {
  if (!value) return "-";
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return `${formatted} UTC+8`;
};

onMounted(loadAll);
</script>

<style scoped>
.task-schedules-page {
  min-height: 100vh;
  background: #f6f8f7;
  padding: 24px;
}

.page-shell {
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-header h1,
.section-title h2 {
  margin: 0;
  color: #17211b;
  letter-spacing: 0;
}

.page-header p {
  margin: 6px 0 0;
  color: #66746b;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-item,
.config-panel,
.list-panel {
  background: #fff;
  border: 1px solid #dfe7e2;
  border-radius: 8px;
}

.summary-item {
  min-height: 76px;
  padding: 14px;
}

.summary-label,
.muted {
  color: #728076;
  font-size: 13px;
}

.summary-item strong {
  display: block;
  margin-top: 8px;
  font-size: 22px;
  color: #1d2a22;
}

.summary-item.success strong {
  color: #15803d;
}

.summary-item.failed strong {
  color: #b42318;
}

.schedule-layout {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.config-panel,
.list-panel {
  padding: 18px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.full-control {
  width: 100%;
}

.task-picker {
  width: 100%;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 10px 2px 4px;
}

.state-alert {
  margin-bottom: 12px;
}

.state-panel {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #66746b;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e3ebe6;
  border-radius: 8px;
  background: #fbfcfb;
}

.schedule-title,
.schedule-meta,
.result-line,
.action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.schedule-title strong {
  color: #16231b;
}

.schedule-meta,
.result-line {
  margin-top: 8px;
  color: #66746b;
  font-size: 13px;
}

.error-text {
  color: #b42318;
}

@media (max-width: 900px) {
  .task-schedules-page {
    padding: 16px;
  }

  .page-header,
  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .schedule-layout,
  .schedule-item,
  .task-grid {
    grid-template-columns: 1fr;
  }
}
</style>
