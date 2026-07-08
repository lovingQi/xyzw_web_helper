import { ref, onUnmounted } from 'vue';

export function useSSE(url = '/api/sse/tasks') {
  const events = ref([]);
  const connected = ref(false);
  let eventSource = null;

  function connect() {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const fullUrl = `${url}?token=${encodeURIComponent(token)}`;
    eventSource = new EventSource(fullUrl);

    eventSource.onopen = () => {
      connected.value = true;
    };

    eventSource.addEventListener('task-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        events.value.unshift(data);
        if (events.value.length > 100) {
          events.value = events.value.slice(0, 100);
        }
      } catch (_) { /* ignore */ }
    });

    eventSource.onerror = () => {
      connected.value = false;
      disconnect();
      setTimeout(connect, 5000);
    };
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    connected.value = false;
  }

  onUnmounted(disconnect);

  return { events, connected, connect, disconnect };
}
