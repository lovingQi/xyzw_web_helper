<template>
  <div class="task-logs-page">
    <div class="page-shell">
      <div class="page-header">
        <div>
          <h1>任务日志</h1>
          <p>查看后端定时登录、任务执行步骤、耗时和失败原因。</p>
        </div>
        <n-space>
          <n-button secondary @click="resetFilters">重置筛选</n-button>
          <n-button type="primary" :loading="loading" @click="loadLogs">
            刷新
          </n-button>
        </n-space>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">日志总数</span>
          <strong>{{ total }}</strong>
        </div>
        <div class="summary-item success">
          <span class="summary-label">成功</span>
          <strong>{{ successCount }}</strong>
        </div>
        <div class="summary-item failed">
          <span class="summary-label">失败</span>
          <strong>{{ failedCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">最近执行</span>
          <strong>{{ latestRunText }}</strong>
        </div>
      </div>

      <div class="filters">
        <n-select
          v-model:value="filters.tokenId"
          clearable
          class="filter-control"
          placeholder="全部Token"
          :options="tokenOptions"
          @update:value="handleTokenChange"
        />
        <n-select
          v-model:value="filters.taskType"
          clearable
          class="filter-control"
          placeholder="全部任务类型"
          :options="taskTypeOptions"
        />
        <n-select
          v-model:value="filters.status"
          clearable
          class="filter-control"
          placeholder="全部状态"
          :options="statusOptions"
        />
      </div>

      <n-alert v-if="error" type="error" class="state-alert">
        {{ error }}
      </n-alert>

      <div v-if="loading && logs.length === 0" class="state-panel">
        <n-spin size="large" />
        <span>正在读取任务日志...</span>
      </div>

      <n-empty
        v-else-if="filteredLogs.length === 0"
        class="state-panel"
        description="还没有符合条件的任务日志"
      />

      <div v-else class="log-list">
        <article v-for="log in filteredLogs" :key="log.id" class="log-item">
          <div class="log-main">
            <div class="log-title">
              <n-tag :type="statusType(log.status)" size="small">
                {{ statusLabel(log.status) }}
              </n-tag>
              <strong>{{ taskTypeLabel(log.task_type) }}</strong>
              <span class="muted">#{{ log.id }}</span>
            </div>
            <div class="log-meta">
              <span>{{ formatDate(log.started_at || log.created_at) }}</span>
              <span>{{ log.token_name || tokenName(log.token_id) }}</span>
              <span>耗时 {{ formatDuration(log.duration_ms) }}</span>
              <span v-if="log.cron_expression">Cron {{ log.cron_expression }}</span>
            </div>
            <div v-if="failureReason(log)" class="error-line">
              {{ failureReason(log) }}
            </div>
            <div class="result-line">
              {{ resultSummary(log) }}
            </div>
            <ul v-if="errorSteps(log).length" class="error-summary">
              <li v-for="(step, index) in errorSteps(log).slice(0, 3)" :key="`${log.id}-error-${index}`">
                {{ step.message }}
              </li>
            </ul>
          </div>
          <n-button text type="primary" @click="toggleExpand(log.id)">
            {{ expandedIds.has(log.id) ? "收起详情" : "展开详情" }}
          </n-button>

          <div v-if="expandedIds.has(log.id)" class="log-detail">
            <div class="detail-grid">
              <div>
                <span class="detail-label">任务配置</span>
                <strong>{{ log.task_config_id ? `#${log.task_config_id}` : "-" }}</strong>
              </div>
              <div>
                <span class="detail-label">开始时间</span>
                <strong>{{ formatDate(log.started_at) }}</strong>
              </div>
              <div>
                <span class="detail-label">完成时间</span>
                <strong>{{ formatDate(log.completed_at) }}</strong>
              </div>
              <div>
                <span class="detail-label">执行结果</span>
                <strong>{{ resultSummary(log) }}</strong>
              </div>
            </div>

            <ol v-if="stepLogs(log).length" class="timeline">
              <li
                v-for="(step, index) in stepLogs(log)"
                :key="`${log.id}-${index}`"
                :class="step.type || 'info'"
              >
                <time>{{ formatTime(step.time) }}</time>
                <span>{{ step.message }}</span>
              </li>
            </ol>
            <pre v-else class="raw-result">{{ prettyResult(log.result) }}</pre>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useMessage } from "naive-ui";
import { tasksApi } from "@/api/tasks";
import { tokensApi } from "@/api/tokens";

const message = useMessage();
const route = useRoute();
const loading = ref(false);
const error = ref("");
const logs = ref([]);
const total = ref(0);
const tokens = ref([]);
const expandedIds = ref(new Set());
const filters = reactive({
  tokenId: null,
  taskConfigId: null,
  taskType: null,
  status: null,
});

const taskTypeOptions = [
  { label: "任务组", value: "task_group" },
  { label: "批量日常", value: "startBatch" },
  { label: "一键爬塔", value: "climbTower" },
  { label: "邮件附件", value: "mail" },
  { label: "每日签到", value: "daily_signin" },
  { label: "军团签到", value: "legion_signin" },
  { label: "领取瓶子", value: "bottle" },
  { label: "免费扭蛋", value: "gacha" },
  { label: "全部日常", value: "daily_all" },
  { label: "竞技场", value: "arena" },
  { label: "Boss", value: "boss" },
  { label: "军团Boss", value: "legion_boss" },
  { label: "分享游戏", value: "daily_share" },
  { label: "好友金币", value: "friend" },
  { label: "招募", value: "recruit" },
  { label: "免费点金", value: "buygold" },
  { label: "挂机奖励", value: "hangup" },
  { label: "挂机加钟", value: "hangup_time" },
  { label: "开箱", value: "open_box" },
  { label: "盐罐启停", value: "bottle_timer" },
  { label: "每日奖励", value: "daily_reward" },
  { label: "任务点奖励", value: "daily_point" },
  { label: "周常奖励", value: "weekly_reward" },
  { label: "通行证奖励", value: "war_order" },
  { label: "每日礼包", value: "daily_gift" },
  { label: "珍宝阁", value: "collection" },
  { label: "免费钓鱼", value: "fishing" },
  { label: "灯神扫荡", value: "genie" },
  { label: "黑市购买", value: "black_market" },
  { label: "咸王梦境", value: "dream" },
];

const statusOptions = [
  { label: "成功", value: "success" },
  { label: "失败", value: "failed" },
  { label: "运行中", value: "running" },
  { label: "等待中", value: "pending" },
];

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
    label: [token.name, token.server].filter(Boolean).join(" · "),
    value: token.id,
  })),
);

const filteredLogs = computed(() =>
  logs.value.filter((log) => {
    if (filters.taskType && log.task_type !== filters.taskType) return false;
    if (filters.status && log.status !== filters.status) return false;
    return true;
  }),
);

const successCount = computed(
  () => logs.value.filter((log) => log.status === "success").length,
);
const failedCount = computed(
  () => logs.value.filter((log) => log.status === "failed").length,
);
const latestRunText = computed(() => {
  const latest = logs.value[0]?.started_at || logs.value[0]?.created_at;
  return latest ? formatDate(latest) : "-";
});

const normalizeLogsResponse = (response) => {
  if (Array.isArray(response)) return { logs: response, total: response.length };
  return {
    logs: Array.isArray(response?.logs) ? response.logs : [],
    total: Number(response?.total ?? response?.logs?.length ?? 0),
  };
};

const loadTokens = async () => {
  try {
    tokens.value = await tokensApi.getTokens();
  } catch (_) {
    tokens.value = [];
  }
};

const loadLogs = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await tasksApi.getLogs({
      tokenId: filters.tokenId,
      taskConfigId: filters.taskConfigId,
      limit: 100,
      offset: 0,
    });
    const normalized = normalizeLogsResponse(response);
    logs.value = normalized.logs;
    total.value = normalized.total;
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || "任务日志读取失败";
    message.error(error.value);
  } finally {
    loading.value = false;
  }
};

const handleTokenChange = () => {
  expandedIds.value = new Set();
  loadLogs();
};

const resetFilters = () => {
  filters.tokenId = null;
  filters.taskConfigId = null;
  filters.taskType = null;
  filters.status = null;
  expandedIds.value = new Set();
  loadLogs();
};

const toggleExpand = (id) => {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
};

const tokenName = (tokenId) => {
  const token = tokens.value.find((item) => item.id === tokenId);
  return token ? [token.name, token.server].filter(Boolean).join(" · ") : `Token #${tokenId}`;
};

const taskTypeLabel = (type) => {
  const item = taskTypeOptions.find((option) => option.value === type);
  return item?.label || type || "-";
};

const statusLabel = (status) => {
  const item = statusOptions.find((option) => option.value === status);
  return item?.label || status || "-";
};

const statusType = (status) => {
  if (status === "success") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "warning";
  return "default";
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

const formatTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
};

const formatDuration = (duration) => {
  if (!Number.isFinite(Number(duration))) return "-";
  const ms = Number(duration);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const stepLogs = (log) => {
  const result = typeof log.result === "string" ? safeJsonParse(log.result) : log.result;
  return Array.isArray(result?.logs) ? result.logs : [];
};

const errorSteps = (log) => stepLogs(log).filter((step) => step.type === "error");

const resultSummary = (log) => {
  const result = typeof log.result === "string" ? safeJsonParse(log.result) : log.result;
  if (!result) return log.error || "-";
  const run = result.tasksRun ?? 0;
  const failed = result.tasksFailed ?? 0;
  return `${run} 成功, ${failed} 失败`;
};

const failureReason = (log) => {
  if (log.status !== "failed") return "";
  if (log.error) return log.error;
  const firstErrorStep = stepLogs(log).find((step) => step.type === "error");
  return firstErrorStep?.message || "";
};

const prettyResult = (result) => {
  if (!result) return "暂无详细步骤";
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

onMounted(async () => {
  filters.tokenId = route.query.tokenId ? Number(route.query.tokenId) : null;
  filters.taskConfigId = route.query.taskConfigId ? Number(route.query.taskConfigId) : null;
  filters.taskType = route.query.taskType ? String(route.query.taskType) : null;
  filters.status = route.query.status ? String(route.query.status) : null;
  await loadTokens();
  await loadLogs();
});
</script>

<style scoped lang="scss">
.task-logs-page {
  min-height: calc(100vh - 64px);
  background: var(--bg-secondary);
  padding: var(--spacing-lg);
}

.page-shell {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);

  h1 {
    margin: 0 0 6px;
    color: var(--text-primary);
    font-size: 28px;
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.summary-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: 6px;

  strong {
    color: var(--text-primary);
    font-size: 22px;
    line-height: 1.2;
  }

  &.success strong {
    color: var(--success-color, #18a058);
  }

  &.failed strong {
    color: var(--error-color, #d03050);
  }
}

.summary-label,
.detail-label {
  color: var(--text-tertiary);
  font-size: 12px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.filter-control {
  width: 220px;
}

.state-alert {
  margin-bottom: var(--spacing-md);
}

.state-panel {
  min-height: 240px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  color: var(--text-secondary);
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.log-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: var(--spacing-md);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--spacing-sm);
}

.log-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-primary);
}

.muted {
  color: var(--text-tertiary);
  font-size: 12px;
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.error-line {
  margin-top: 10px;
  color: var(--error-color, #d03050);
  font-size: 13px;
}

.result-line {
  margin-top: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.error-summary {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--error-color, #d03050);
  font-size: 12px;
  line-height: 1.5;

  li + li {
    margin-top: 4px;
  }
}

.log-detail {
  grid-column: 1 / -1;
  border-top: 1px solid var(--border-light);
  padding-top: var(--spacing-md);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);

  > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  strong {
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }
}

.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: var(--spacing-sm);
    align-items: start;
    color: var(--text-secondary);
    font-size: 13px;

    &::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-tertiary);
      grid-column: 1;
      grid-row: 1;
      justify-self: end;
      margin-top: 6px;
    }

    time {
      color: var(--text-tertiary);
      grid-column: 1;
      padding-right: 16px;
    }

    span {
      grid-column: 2;
      overflow-wrap: anywhere;
    }

    &.success::before {
      background: var(--success-color, #18a058);
    }

    &.error::before {
      background: var(--error-color, #d03050);
    }
  }
}

.raw-result {
  margin: 0;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .task-logs-page {
    padding: var(--spacing-md);
  }

  .page-header {
    flex-direction: column;
  }

  .summary-grid,
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-control {
    width: 100%;
  }

  .log-item {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
