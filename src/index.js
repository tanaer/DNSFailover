// DNS Failover Worker for Cloudflare
// 存储键名常量
const KEYS = {
  API_CONFIGS: 'api_configs',
  FAILOVER_POLICIES: 'failover_policies',
  MONITORS: 'monitors',
  SWITCH_LOGS: 'switch_logs',
  MONITOR_STATUS: 'monitor_status'
};

// 获取 HTML 页面
function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DNS Failover 管理面板</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a2e; margin-bottom: 20px; text-align: center; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .tab { padding: 10px 20px; background: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.3s; }
    .tab:hover { background: #e8e8e8; }
    .tab.active { background: #4361ee; color: #fff; }
    .panel { display: none; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .panel.active { display: block; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #333; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #4361ee; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.3s; }
    .btn-primary { background: #4361ee; color: #fff; }
    .btn-primary:hover { background: #3651d4; }
    .btn-success { background: #2ecc71; color: #fff; }
    .btn-success:hover { background: #27ae60; }
    .btn-danger { background: #e74c3c; color: #fff; }
    .btn-danger:hover { background: #c0392b; }
    .btn-secondary { background: #6c757d; color: #fff; }
    .btn-secondary:hover { background: #5a6268; }
    .list-item { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .list-item-info { flex: 1; min-width: 200px; }
    .list-item-info h4 { color: #333; margin-bottom: 5px; }
    .list-item-info p { color: #666; font-size: 13px; }
    .list-item-actions { display: flex; gap: 8px; }
    .status { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .status-success { background: #d4edda; color: #155724; }
    .status-error { background: #f8d7da; color: #721c24; }
    .status-warning { background: #fff3cd; color: #856404; }
    .log-item { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #4361ee; }
    .log-item .time { color: #666; font-size: 12px; }
    .log-item .content { margin-top: 5px; color: #333; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000; }
    .modal.show { display: flex; }
    .modal-content { background: #fff; border-radius: 12px; padding: 25px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h3 { color: #333; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
    .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: #fff; z-index: 2000; animation: slideIn 0.3s ease; }
    .toast-success { background: #2ecc71; }
    .toast-error { background: #e74c3c; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .empty-state { text-align: center; padding: 40px; color: #666; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ DNS Failover 管理面板</h1>
    
    <div class="tabs">
      <button class="tab active" data-panel="api-config">API 配置</button>
      <button class="tab" data-panel="failover-policy">Failover 策略</button>
      <button class="tab" data-panel="monitors">监控配置</button>
      <button class="tab" data-panel="logs">切换日志</button>
      <button class="tab" data-panel="status">监控状态</button>
    </div>

    <!-- API 配置面板 -->
    <div id="api-config" class="panel active">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>API 配置列表</h3>
        <button class="btn btn-primary" onclick="showAddApiModal()">+ 添加 API</button>
      </div>
      <div id="api-list"></div>
    </div>

    <!-- Failover 策略面板 -->
    <div id="failover-policy" class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>Failover 策略列表</h3>
        <button class="btn btn-primary" onclick="showAddPolicyModal()">+ 添加策略</button>
      </div>
      <div id="policy-list"></div>
    </div>

    <!-- 监控配置面板 -->
    <div id="monitors" class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>监控配置列表</h3>
        <button class="btn btn-primary" onclick="showAddMonitorModal()">+ 添加监控</button>
      </div>
      <div id="monitor-list"></div>
    </div>

    <!-- 切换日志面板 -->
    <div id="logs" class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>切换日志</h3>
        <button class="btn btn-danger" onclick="clearLogs()">清空日志</button>
      </div>
      <div id="log-list"></div>
    </div>

    <!-- 监控状态面板 -->
    <div id="status" class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>实时监控状态</h3>
        <button class="btn btn-secondary" onclick="refreshStatus()">刷新状态</button>
      </div>
      <div id="status-list"></div>
    </div>
  </div>

  <!-- API 配置模态框 -->
  <div id="api-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="api-modal-title">添加 API 配置</h3>
        <button class="modal-close" onclick="closeModal('api-modal')">&times;</button>
      </div>
      <form id="api-form">
        <input type="hidden" id="api-id">
        <div class="form-group">
          <label>配置名称</label>
          <input type="text" id="api-name" required placeholder="例如: 主站点API">
        </div>
        <div class="form-group">
          <label>区域 ID (Zone ID)</label>
          <input type="text" id="api-zone-id" required placeholder="32位字符">
        </div>
        <div class="form-group">
          <label>API 令牌</label>
          <input type="password" id="api-token" required placeholder="Cloudflare API Token">
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-success" onclick="testApi()">测试连接</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Failover 策略模态框 -->
  <div id="policy-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="policy-modal-title">添加 Failover 策略</h3>
        <button class="modal-close" onclick="closeModal('policy-modal')">&times;</button>
      </div>
      <form id="policy-form">
        <input type="hidden" id="policy-id">
        <div class="form-group">
          <label>策略名称</label>
          <input type="text" id="policy-name" required placeholder="例如: 切换到备用服务器">
        </div>
        <div class="form-group">
          <label>域名列表（每行一个域名）</label>
          <textarea id="policy-domains" required rows="4" placeholder="www.example.com&#10;api.example.com&#10;cdn.example.com"></textarea>
        </div>
        <div class="form-group">
          <label>记录类型</label>
          <select id="policy-record-type" required>
            <option value="A">A (IPv4)</option>
            <option value="CNAME">CNAME</option>
            <option value="AAAA">AAAA (IPv6)</option>
          </select>
        </div>
        <div class="form-group">
          <label>目标内容</label>
          <input type="text" id="policy-content" required placeholder="IP地址或域名">
        </div>
        <div class="form-group">
          <label>使用的 API 配置</label>
          <select id="policy-api-id" required></select>
        </div>
        <div class="form-group">
          <label>TTL</label>
          <select id="policy-ttl">
            <option value="1">自动</option>
            <option value="60">1 分钟</option>
            <option value="120">2 分钟</option>
            <option value="300">5 分钟</option>
            <option value="600">10 分钟</option>
            <option value="1800">30 分钟</option>
            <option value="3600">1 小时</option>
            <option value="86400">1 天</option>
          </select>
        </div>
        <div class="form-group">
          <label>代理状态</label>
          <select id="policy-proxied">
            <option value="true">启用 Cloudflare 代理</option>
            <option value="false">仅 DNS</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">保存</button>
      </form>
    </div>
  </div>

  <!-- 监控配置模态框 -->
  <div id="monitor-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="monitor-modal-title">添加监控配置</h3>
        <button class="modal-close" onclick="closeModal('monitor-modal')">&times;</button>
      </div>
      <form id="monitor-form">
        <input type="hidden" id="monitor-id">
        <div class="form-group">
          <label>监控名称</label>
          <input type="text" id="monitor-name" required placeholder="例如: 主站健康检查">
        </div>
        <div class="form-group">
          <label>监控 URL</label>
          <input type="url" id="monitor-url" required placeholder="https://example.com/health">
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>检查间隔 (秒)</label>
            <input type="number" id="monitor-interval" value="60" min="10">
          </div>
          <div class="form-group">
            <label>超时时间 (秒)</label>
            <input type="number" id="monitor-timeout" value="10" min="1" max="30">
          </div>
        </div>
        <div class="form-group">
          <label>预期状态码</label>
          <input type="text" id="monitor-expected-status" value="200" placeholder="200 或 200,201,204">
        </div>
        <div class="form-group">
          <label>预期响应内容 (可选，支持正则)</label>
          <input type="text" id="monitor-expected-body" placeholder="留空则不检查">
        </div>
        <div class="form-group">
          <label>连续失败次数阈值</label>
          <input type="number" id="monitor-failure-threshold" value="3" min="1">
        </div>
        <div class="form-group">
          <label>失败时触发的 Failover 策略</label>
          <select id="monitor-policy-id" required></select>
        </div>
        <div class="form-group">
          <label>恢复时触发的 Failover 策略 (可选)</label>
          <select id="monitor-recovery-policy-id">
            <option value="">不自动恢复</option>
          </select>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="monitor-enabled" checked> 启用监控
          </label>
        </div>
        <button type="submit" class="btn btn-primary">保存</button>
      </form>
    </div>
  </div>

  <script>
    // 状态数据
    let apiConfigs = [];
    let policies = [];
    let monitors = [];
    let logs = [];
    let monitorStatus = {};

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
      initTabs();
      loadAllData();
    });

    // 标签页切换
    function initTabs() {
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById(tab.dataset.panel).classList.add('active');
        });
      });
    }

    // 加载所有数据
    async function loadAllData() {
      await Promise.all([loadApiConfigs(), loadPolicies(), loadMonitors(), loadLogs(), loadStatus()]);
    }

    // Toast 提示
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    // 模态框控制
    function showModal(id) { document.getElementById(id).classList.add('show'); }
    function closeModal(id) { document.getElementById(id).classList.remove('show'); }

    // ========== API 配置 ==========
    async function loadApiConfigs() {
      try {
        const res = await fetch('/api/configs');
        apiConfigs = await res.json();
        renderApiList();
        updateApiSelects();
      } catch (e) {
        console.error('加载API配置失败', e);
      }
    }

    function renderApiList() {
      const container = document.getElementById('api-list');
      if (apiConfigs.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无 API 配置，请点击上方按钮添加</div>';
        return;
      }
      container.innerHTML = apiConfigs.map(api => \`
        <div class="list-item">
          <div class="list-item-info">
            <h4>\${api.name}</h4>
            <p>Zone ID: \${api.zoneId.substring(0, 8)}...</p>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-success btn-sm" onclick="testApiById('\${api.id}')">测试</button>
            <button class="btn btn-secondary btn-sm" onclick="editApi('\${api.id}')">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="deleteApi('\${api.id}')">删除</button>
          </div>
        </div>
      \`).join('');
    }

    function showAddApiModal() {
      document.getElementById('api-modal-title').textContent = '添加 API 配置';
      document.getElementById('api-form').reset();
      document.getElementById('api-id').value = '';
      showModal('api-modal');
    }

    function editApi(id) {
      const api = apiConfigs.find(a => a.id === id);
      if (!api) return;
      document.getElementById('api-modal-title').textContent = '编辑 API 配置';
      document.getElementById('api-id').value = api.id;
      document.getElementById('api-name').value = api.name;
      document.getElementById('api-zone-id').value = api.zoneId;
      document.getElementById('api-token').value = api.token;
      showModal('api-modal');
    }

    async function testApi() {
      const zoneId = document.getElementById('api-zone-id').value;
      const token = document.getElementById('api-token').value;
      if (!zoneId || !token) {
        showToast('请填写区域ID和API令牌', 'error');
        return;
      }
      try {
        const res = await fetch('/api/configs/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoneId, token })
        });
        const data = await res.json();
        if (data.success) {
          showToast('连接成功！共找到 ' + data.recordCount + ' 条DNS记录');
        } else {
          showToast('连接失败: ' + data.error, 'error');
        }
      } catch (e) {
        showToast('测试失败: ' + e.message, 'error');
      }
    }

    async function testApiById(id) {
      try {
        const res = await fetch('/api/configs/' + id + '/test', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('连接成功！共找到 ' + data.recordCount + ' 条DNS记录');
        } else {
          showToast('连接失败: ' + data.error, 'error');
        }
      } catch (e) {
        showToast('测试失败: ' + e.message, 'error');
      }
    }

    document.getElementById('api-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('api-id').value || crypto.randomUUID();
      const data = {
        id,
        name: document.getElementById('api-name').value,
        zoneId: document.getElementById('api-zone-id').value,
        token: document.getElementById('api-token').value
      };
      try {
        await fetch('/api/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        showToast('保存成功');
        closeModal('api-modal');
        loadApiConfigs();
      } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
      }
    });

    async function deleteApi(id) {
      if (!confirm('确定要删除这个API配置吗？')) return;
      try {
        await fetch('/api/configs/' + id, { method: 'DELETE' });
        showToast('删除成功');
        loadApiConfigs();
      } catch (e) {
        showToast('删除失败: ' + e.message, 'error');
      }
    }

    function updateApiSelects() {
      const options = apiConfigs.map(a => \`<option value="\${a.id}">\${a.name}</option>\`).join('');
      document.getElementById('policy-api-id').innerHTML = options || '<option value="">请先添加API配置</option>';
    }

    // ========== Failover 策略 ==========
    async function loadPolicies() {
      try {
        const res = await fetch('/api/policies');
        policies = await res.json();
        renderPolicyList();
        updatePolicySelects();
      } catch (e) {
        console.error('加载策略失败', e);
      }
    }

    function renderPolicyList() {
      const container = document.getElementById('policy-list');
      if (policies.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无 Failover 策略，请点击上方按钮添加</div>';
        return;
      }
      container.innerHTML = policies.map(p => {
        const api = apiConfigs.find(a => a.id === p.apiId);
        const domains = Array.isArray(p.domains) ? p.domains : [p.domain].filter(Boolean);
        const domainDisplay = domains.length > 1 ? domains[0] + ' 等' + domains.length + '个域名' : domains[0];
        return \`
          <div class="list-item">
            <div class="list-item-info">
              <h4>\${p.name}</h4>
              <p>\${domainDisplay} → \${p.recordType} → \${p.content}</p>
              <p>使用API: \${api ? api.name : '未知'} | TTL: \${p.ttl == 1 ? '自动' : p.ttl + '秒'}</p>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-success btn-sm" onclick="executePolicy('\${p.id}')">立即执行</button>
              <button class="btn btn-secondary btn-sm" onclick="editPolicy('\${p.id}')">编辑</button>
              <button class="btn btn-danger btn-sm" onclick="deletePolicy('\${p.id}')">删除</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function showAddPolicyModal() {
      document.getElementById('policy-modal-title').textContent = '添加 Failover 策略';
      document.getElementById('policy-form').reset();
      document.getElementById('policy-id').value = '';
      document.getElementById('policy-ttl').value = '1';
      showModal('policy-modal');
    }

    function editPolicy(id) {
      const p = policies.find(x => x.id === id);
      if (!p) return;
      document.getElementById('policy-modal-title').textContent = '编辑 Failover 策略';
      document.getElementById('policy-id').value = p.id;
      document.getElementById('policy-name').value = p.name;
      const domains = Array.isArray(p.domains) ? p.domains : [p.domain].filter(Boolean);
      document.getElementById('policy-domains').value = domains.join('\\n');
      document.getElementById('policy-record-type').value = p.recordType;
      document.getElementById('policy-content').value = p.content;
      document.getElementById('policy-api-id').value = p.apiId;
      document.getElementById('policy-ttl').value = p.ttl || 1;
      document.getElementById('policy-proxied').value = String(p.proxied !== false);
      showModal('policy-modal');
    }

    document.getElementById('policy-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('policy-id').value || crypto.randomUUID();
      const domainsText = document.getElementById('policy-domains').value;
      const domains = domainsText.split('\\n').map(d => d.trim()).filter(d => d);
      const data = {
        id,
        name: document.getElementById('policy-name').value,
        domains: domains,
        recordType: document.getElementById('policy-record-type').value,
        content: document.getElementById('policy-content').value,
        apiId: document.getElementById('policy-api-id').value,
        ttl: parseInt(document.getElementById('policy-ttl').value) || 1,
        proxied: document.getElementById('policy-proxied').value === 'true'
      };
      try {
        await fetch('/api/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        showToast('保存成功');
        closeModal('policy-modal');
        loadPolicies();
      } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
      }
    });

    async function deletePolicy(id) {
      if (!confirm('确定要删除这个策略吗？')) return;
      try {
        await fetch('/api/policies/' + id, { method: 'DELETE' });
        showToast('删除成功');
        loadPolicies();
      } catch (e) {
        showToast('删除失败: ' + e.message, 'error');
      }
    }

    async function executePolicy(id) {
      if (!confirm('确定要立即执行此策略吗？这将修改DNS记录。')) return;
      try {
        const res = await fetch('/api/policies/' + id + '/execute', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('策略执行成功');
          loadLogs();
        } else {
          showToast('执行失败: ' + data.error, 'error');
        }
      } catch (e) {
        showToast('执行失败: ' + e.message, 'error');
      }
    }

    function updatePolicySelects() {
      const options = policies.map(p => \`<option value="\${p.id}">\${p.name}</option>\`).join('');
      document.getElementById('monitor-policy-id').innerHTML = options || '<option value="">请先添加策略</option>';
      document.getElementById('monitor-recovery-policy-id').innerHTML = '<option value="">不自动恢复</option>' + options;
    }

    // ========== 监控配置 ==========
    async function loadMonitors() {
      try {
        const res = await fetch('/api/monitors');
        monitors = await res.json();
        renderMonitorList();
      } catch (e) {
        console.error('加载监控配置失败', e);
      }
    }

    function renderMonitorList() {
      const container = document.getElementById('monitor-list');
      if (monitors.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无监控配置，请点击上方按钮添加</div>';
        return;
      }
      container.innerHTML = monitors.map(m => {
        const policy = policies.find(p => p.id === m.policyId);
        const status = monitorStatus[m.id];
        let statusHtml = '';
        if (status) {
          const statusClass = status.healthy ? 'status-success' : 'status-error';
          const statusText = status.healthy ? '正常' : \`异常(\${status.failureCount}次)\`;
          statusHtml = \`<span class="status \${statusClass}">\${statusText}</span>\`;
        }
        return \`
          <div class="list-item">
            <div class="list-item-info">
              <h4>\${m.name} \${m.enabled ? '' : '<span class="status status-warning">已禁用</span>'} \${statusHtml}</h4>
              <p>URL: \${m.url}</p>
              <p>间隔: \${m.interval}秒 | 失败阈值: \${m.failureThreshold}次 | 触发策略: \${policy ? policy.name : '未知'}</p>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-success btn-sm" onclick="testMonitor('\${m.id}')">测试</button>
              <button class="btn btn-secondary btn-sm" onclick="editMonitor('\${m.id}')">编辑</button>
              <button class="btn btn-danger btn-sm" onclick="deleteMonitor('\${m.id}')">删除</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function showAddMonitorModal() {
      document.getElementById('monitor-modal-title').textContent = '添加监控配置';
      document.getElementById('monitor-form').reset();
      document.getElementById('monitor-id').value = '';
      document.getElementById('monitor-interval').value = '60';
      document.getElementById('monitor-timeout').value = '10';
      document.getElementById('monitor-expected-status').value = '200';
      document.getElementById('monitor-failure-threshold').value = '3';
      document.getElementById('monitor-enabled').checked = true;
      showModal('monitor-modal');
    }

    function editMonitor(id) {
      const m = monitors.find(x => x.id === id);
      if (!m) return;
      document.getElementById('monitor-modal-title').textContent = '编辑监控配置';
      document.getElementById('monitor-id').value = m.id;
      document.getElementById('monitor-name').value = m.name;
      document.getElementById('monitor-url').value = m.url;
      document.getElementById('monitor-interval').value = m.interval;
      document.getElementById('monitor-timeout').value = m.timeout || 10;
      document.getElementById('monitor-expected-status').value = m.expectedStatus;
      document.getElementById('monitor-expected-body').value = m.expectedBody || '';
      document.getElementById('monitor-failure-threshold').value = m.failureThreshold;
      document.getElementById('monitor-policy-id').value = m.policyId;
      document.getElementById('monitor-recovery-policy-id').value = m.recoveryPolicyId || '';
      document.getElementById('monitor-enabled').checked = m.enabled !== false;
      showModal('monitor-modal');
    }

    document.getElementById('monitor-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('monitor-id').value || crypto.randomUUID();
      const data = {
        id,
        name: document.getElementById('monitor-name').value,
        url: document.getElementById('monitor-url').value,
        interval: parseInt(document.getElementById('monitor-interval').value) || 60,
        timeout: parseInt(document.getElementById('monitor-timeout').value) || 10,
        expectedStatus: document.getElementById('monitor-expected-status').value,
        expectedBody: document.getElementById('monitor-expected-body').value,
        failureThreshold: parseInt(document.getElementById('monitor-failure-threshold').value) || 3,
        policyId: document.getElementById('monitor-policy-id').value,
        recoveryPolicyId: document.getElementById('monitor-recovery-policy-id').value,
        enabled: document.getElementById('monitor-enabled').checked
      };
      try {
        await fetch('/api/monitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        showToast('保存成功');
        closeModal('monitor-modal');
        loadMonitors();
      } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
      }
    });

    async function deleteMonitor(id) {
      if (!confirm('确定要删除这个监控配置吗？')) return;
      try {
        await fetch('/api/monitors/' + id, { method: 'DELETE' });
        showToast('删除成功');
        loadMonitors();
      } catch (e) {
        showToast('删除失败: ' + e.message, 'error');
      }
    }

    async function testMonitor(id) {
      try {
        const res = await fetch('/api/monitors/' + id + '/test', { method: 'POST' });
        const data = await res.json();
        if (data.healthy) {
          showToast(\`监控正常 - 状态码: \${data.statusCode}, 耗时: \${data.responseTime}ms\`);
        } else {
          showToast(\`监控异常: \${data.error}\`, 'error');
        }
      } catch (e) {
        showToast('测试失败: ' + e.message, 'error');
      }
    }

    // ========== 日志 ==========
    async function loadLogs() {
      try {
        const res = await fetch('/api/logs');
        logs = await res.json();
        renderLogList();
      } catch (e) {
        console.error('加载日志失败', e);
      }
    }

    function renderLogList() {
      const container = document.getElementById('log-list');
      if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无切换日志</div>';
        return;
      }
      container.innerHTML = logs.map(log => {
        const domains = Array.isArray(log.domains) ? log.domains : [log.domain].filter(Boolean);
        const domainDisplay = domains.join(', ');
        const resultInfo = log.successCount !== undefined ? 
          ' (成功: ' + log.successCount + ', 失败: ' + (log.errorCount || 0) + ')' : '';
        const errorsHtml = log.errors && log.errors.length > 0 ? '<br>错误: ' + log.errors.join('; ') : '';
        return \`
        <div class="log-item">
          <div class="time">\${new Date(log.time).toLocaleString()}</div>
          <div class="content">
            <strong>\${log.type === 'failover' ? '⚠️ 故障切换' : '✅ 恢复切换'}\${resultInfo}</strong><br>
            监控: \${log.monitorName || '手动执行'}<br>
            策略: \${log.policyName}<br>
            域名: \${domainDisplay} → \${log.content}<br>
            \${log.reason ? '原因: ' + log.reason : ''}\${errorsHtml}
          </div>
        </div>
      \`;
      }).join('');
    }

    async function clearLogs() {
      if (!confirm('确定要清空所有日志吗？')) return;
      try {
        await fetch('/api/logs', { method: 'DELETE' });
        showToast('日志已清空');
        loadLogs();
      } catch (e) {
        showToast('清空失败: ' + e.message, 'error');
      }
    }

    // ========== 状态 ==========
    async function loadStatus() {
      try {
        const res = await fetch('/api/status');
        monitorStatus = await res.json();
        renderStatusList();
        renderMonitorList();
      } catch (e) {
        console.error('加载状态失败', e);
      }
    }

    function renderStatusList() {
      const container = document.getElementById('status-list');
      const entries = Object.entries(monitorStatus);
      if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无监控状态数据</div>';
        return;
      }
      container.innerHTML = entries.map(([id, status]) => {
        const monitor = monitors.find(m => m.id === id);
        const statusClass = status.healthy ? 'status-success' : 'status-error';
        const statusText = status.healthy ? '正常' : '异常';
        return \`
          <div class="list-item">
            <div class="list-item-info">
              <h4>\${monitor ? monitor.name : id} <span class="status \${statusClass}">\${statusText}</span></h4>
              <p>连续失败次数: \${status.failureCount} | 最后检查: \${status.lastCheck ? new Date(status.lastCheck).toLocaleString() : '从未'}</p>
              <p>最后状态码: \${status.lastStatusCode || '-'} | 最后耗时: \${status.lastResponseTime || '-'}ms</p>
              \${status.lastError ? '<p style="color:#e74c3c">错误: ' + status.lastError + '</p>' : ''}
            </div>
          </div>
        \`;
      }).join('');
    }

    function refreshStatus() {
      loadStatus();
      showToast('状态已刷新');
    }
  </script>
</body>
</html>`;
}

// 主请求处理
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 处理
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      // 首页
      if (path === '/' || path === '') {
        return new Response(getHTML(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // API 配置接口
      if (path === '/api/configs' && method === 'GET') {
        const configs = await getStoredData(env, KEYS.API_CONFIGS);
        return Response.json(configs, { headers: corsHeaders });
      }

      if (path === '/api/configs' && method === 'POST') {
        const data = await request.json();
        const configs = await getStoredData(env, KEYS.API_CONFIGS);
        const index = configs.findIndex(c => c.id === data.id);
        if (index >= 0) {
          configs[index] = data;
        } else {
          configs.push(data);
        }
        await saveStoredData(env, KEYS.API_CONFIGS, configs);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/api/configs/test' && method === 'POST') {
        const { zoneId, token } = await request.json();
        const result = await testCloudflareApi(zoneId, token);
        return Response.json(result, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/configs\/[^/]+\/test$/) && method === 'POST') {
        const id = path.split('/')[3];
        const configs = await getStoredData(env, KEYS.API_CONFIGS);
        const config = configs.find(c => c.id === id);
        if (!config) {
          return Response.json({ success: false, error: 'API配置不存在' }, { headers: corsHeaders });
        }
        const result = await testCloudflareApi(config.zoneId, config.token);
        return Response.json(result, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/configs\/[^/]+$/) && method === 'DELETE') {
        const id = path.split('/')[3];
        let configs = await getStoredData(env, KEYS.API_CONFIGS);
        configs = configs.filter(c => c.id !== id);
        await saveStoredData(env, KEYS.API_CONFIGS, configs);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // Failover 策略接口
      if (path === '/api/policies' && method === 'GET') {
        const policies = await getStoredData(env, KEYS.FAILOVER_POLICIES);
        return Response.json(policies, { headers: corsHeaders });
      }

      if (path === '/api/policies' && method === 'POST') {
        const data = await request.json();
        const policies = await getStoredData(env, KEYS.FAILOVER_POLICIES);
        const index = policies.findIndex(p => p.id === data.id);
        if (index >= 0) {
          policies[index] = data;
        } else {
          policies.push(data);
        }
        await saveStoredData(env, KEYS.FAILOVER_POLICIES, policies);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/policies\/[^/]+$/) && method === 'DELETE') {
        const id = path.split('/')[3];
        let policies = await getStoredData(env, KEYS.FAILOVER_POLICIES);
        policies = policies.filter(p => p.id !== id);
        await saveStoredData(env, KEYS.FAILOVER_POLICIES, policies);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/policies\/[^/]+\/execute$/) && method === 'POST') {
        const id = path.split('/')[3];
        const policies = await getStoredData(env, KEYS.FAILOVER_POLICIES);
        const policy = policies.find(p => p.id === id);
        if (!policy) {
          return Response.json({ success: false, error: '策略不存在' }, { headers: corsHeaders });
        }
        const configs = await getStoredData(env, KEYS.API_CONFIGS);
        const apiConfig = configs.find(c => c.id === policy.apiId);
        if (!apiConfig) {
          return Response.json({ success: false, error: 'API配置不存在' }, { headers: corsHeaders });
        }
        const result = await executeFailoverPolicy(env, policy, apiConfig, '手动执行');
        return Response.json(result, { headers: corsHeaders });
      }

      // 监控配置接口
      if (path === '/api/monitors' && method === 'GET') {
        const monitors = await getStoredData(env, KEYS.MONITORS);
        return Response.json(monitors, { headers: corsHeaders });
      }

      if (path === '/api/monitors' && method === 'POST') {
        const data = await request.json();
        const monitors = await getStoredData(env, KEYS.MONITORS);
        const index = monitors.findIndex(m => m.id === data.id);
        if (index >= 0) {
          monitors[index] = data;
        } else {
          monitors.push(data);
        }
        await saveStoredData(env, KEYS.MONITORS, monitors);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/monitors\/[^/]+$/) && method === 'DELETE') {
        const id = path.split('/')[3];
        let monitors = await getStoredData(env, KEYS.MONITORS);
        monitors = monitors.filter(m => m.id !== id);
        await saveStoredData(env, KEYS.MONITORS, monitors);
        // 同时删除状态
        const status = await getStoredData(env, KEYS.MONITOR_STATUS);
        delete status[id];
        await saveStoredData(env, KEYS.MONITOR_STATUS, status);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/monitors\/[^/]+\/test$/) && method === 'POST') {
        const id = path.split('/')[3];
        const monitors = await getStoredData(env, KEYS.MONITORS);
        const monitor = monitors.find(m => m.id === id);
        if (!monitor) {
          return Response.json({ healthy: false, error: '监控配置不存在' }, { headers: corsHeaders });
        }
        const result = await checkHealth(monitor);
        return Response.json(result, { headers: corsHeaders });
      }

      // 日志接口
      if (path === '/api/logs' && method === 'GET') {
        const logs = await getStoredData(env, KEYS.SWITCH_LOGS);
        return Response.json(logs, { headers: corsHeaders });
      }

      if (path === '/api/logs' && method === 'DELETE') {
        await saveStoredData(env, KEYS.SWITCH_LOGS, []);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // 状态接口
      if (path === '/api/status' && method === 'GET') {
        const status = await getStoredData(env, KEYS.MONITOR_STATUS);
        return Response.json(status, { headers: corsHeaders });
      }

      // 手动触发检查
      if (path === '/api/check' && method === 'POST') {
        await runHealthChecks(env);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error:', error);
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
  },

  // 定时任务处理
  async scheduled(event, env, ctx) {
    await runHealthChecks(env);
  }
};

// ========== 辅助函数 ==========

async function getStoredData(env, key) {
  try {
    const data = await env.KV.get(key);
    if (!data) return key === KEYS.MONITOR_STATUS ? {} : [];
    return JSON.parse(data);
  } catch (e) {
    console.error('getStoredData error:', e);
    return key === KEYS.MONITOR_STATUS ? {} : [];
  }
}

async function saveStoredData(env, key, data) {
  await env.KV.put(key, JSON.stringify(data));
}

// 测试 Cloudflare API
async function testCloudflareApi(zoneId, token) {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const data = await response.json();
    if (data.success) {
      return { success: true, recordCount: data.result.length };
    } else {
      const errorMsg = data.errors?.map(e => `${e.code}: ${e.message}`).join('; ') || 'Unknown error';
      return { success: false, error: errorMsg };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 执行 Failover 策略
async function executeFailoverPolicy(env, policy, apiConfig, reason, monitorName = null, type = 'failover') {
  try {
    // 支持多域名，兼容旧版单域名格式
    const domains = Array.isArray(policy.domains) ? policy.domains : [policy.domain].filter(Boolean);
    const results = [];
    const errors = [];

    for (const domain of domains) {
      try {
        // 获取 DNS 记录 ID
        const listResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${apiConfig.zoneId}/dns_records?name=${domain}&type=${policy.recordType}`,
          {
            headers: {
              'Authorization': `Bearer ${apiConfig.token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const listData = await listResponse.json();
        
        // TTL: 1 表示自动
        const ttl = policy.ttl || 1;
        
        if (!listData.success || listData.result.length === 0) {
          // 记录不存在，创建新记录
          const createResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${apiConfig.zoneId}/dns_records`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiConfig.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: policy.recordType,
                name: domain,
                content: policy.content,
                ttl: ttl,
                proxied: policy.proxied !== false
              })
            }
          );
          const createData = await createResponse.json();
          if (!createData.success) {
            errors.push(`${domain}: ${createData.errors?.[0]?.message || 'Failed to create'}`);
          } else {
            results.push(domain);
          }
        } else {
          // 更新现有记录
          const recordId = listData.result[0].id;
          const updateResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${apiConfig.zoneId}/dns_records/${recordId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${apiConfig.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                content: policy.content,
                ttl: ttl,
                proxied: policy.proxied !== false
              })
            }
          );
          const updateData = await updateResponse.json();
          if (!updateData.success) {
            errors.push(`${domain}: ${updateData.errors?.[0]?.message || 'Failed to update'}`);
          } else {
            results.push(domain);
          }
        }
      } catch (e) {
        errors.push(`${domain}: ${e.message}`);
      }
    }

    // 记录日志
    const logs = await getStoredData(env, KEYS.SWITCH_LOGS);
    logs.unshift({
      time: new Date().toISOString(),
      type: type,
      monitorName: monitorName,
      policyName: policy.name,
      domains: domains,
      content: policy.content,
      reason: reason,
      successCount: results.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
    // 只保留最近 100 条日志
    if (logs.length > 100) {
      logs.length = 100;
    }
    await saveStoredData(env, KEYS.SWITCH_LOGS, logs);

    if (errors.length > 0 && results.length === 0) {
      return { success: false, error: errors.join('; ') };
    }
    return { success: true, updated: results.length, failed: errors.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 健康检查
async function checkHealth(monitor) {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (monitor.timeout || 10) * 1000);
    
    const response = await fetch(monitor.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DNS-Failover-Monitor/1.0'
      }
    });
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    // 检查状态码
    const expectedStatuses = monitor.expectedStatus.split(',').map(s => parseInt(s.trim()));
    if (!expectedStatuses.includes(statusCode)) {
      return {
        healthy: false,
        statusCode,
        responseTime,
        error: `状态码不匹配: 期望 ${monitor.expectedStatus}, 实际 ${statusCode}`
      };
    }
    
    // 检查响应内容
    if (monitor.expectedBody) {
      const body = await response.text();
      const regex = new RegExp(monitor.expectedBody);
      if (!regex.test(body)) {
        return {
          healthy: false,
          statusCode,
          responseTime,
          error: '响应内容不匹配'
        };
      }
    }
    
    return { healthy: true, statusCode, responseTime };
  } catch (e) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: e.name === 'AbortError' ? '请求超时' : e.message
    };
  }
}

// 执行所有健康检查
async function runHealthChecks(env) {
  const monitors = await getStoredData(env, KEYS.MONITORS);
  const policies = await getStoredData(env, KEYS.FAILOVER_POLICIES);
  const configs = await getStoredData(env, KEYS.API_CONFIGS);
  let status = await getStoredData(env, KEYS.MONITOR_STATUS);
  
  const now = Date.now();
  
  for (const monitor of monitors) {
    if (!monitor.enabled) continue;
    
    // 检查是否到达检查时间
    const lastStatus = status[monitor.id] || { failureCount: 0, healthy: true };
    const lastCheck = lastStatus.lastCheck || 0;
    
    if (now - lastCheck < monitor.interval * 1000) {
      continue; // 还没到检查时间
    }
    
    // 执行健康检查
    const result = await checkHealth(monitor);
    
    // 更新状态
    const newStatus = {
      healthy: result.healthy,
      failureCount: result.healthy ? 0 : (lastStatus.failureCount || 0) + 1,
      lastCheck: now,
      lastStatusCode: result.statusCode,
      lastResponseTime: result.responseTime,
      lastError: result.error
    };
    
    // 检查是否需要触发 Failover
    const wasHealthy = lastStatus.healthy !== false;
    const isNowUnhealthy = !result.healthy && newStatus.failureCount >= monitor.failureThreshold;
    
    if (wasHealthy && isNowUnhealthy) {
      // 触发 Failover
      const policy = policies.find(p => p.id === monitor.policyId);
      const apiConfig = configs.find(c => c.id === policy?.apiId);
      
      if (policy && apiConfig) {
        await executeFailoverPolicy(
          env, 
          policy, 
          apiConfig, 
          `连续失败 ${newStatus.failureCount} 次: ${result.error}`,
          monitor.name,
          'failover'
        );
        newStatus.healthy = false;
        newStatus.failoverTriggered = true;
      }
    }
    
    // 检查是否恢复
    const wasUnhealthy = lastStatus.healthy === false && lastStatus.failoverTriggered;
    const isNowHealthy = result.healthy;
    
    if (wasUnhealthy && isNowHealthy && monitor.recoveryPolicyId) {
      // 触发恢复策略
      const recoveryPolicy = policies.find(p => p.id === monitor.recoveryPolicyId);
      const apiConfig = configs.find(c => c.id === recoveryPolicy?.apiId);
      
      if (recoveryPolicy && apiConfig) {
        await executeFailoverPolicy(
          env,
          recoveryPolicy,
          apiConfig,
          '服务恢复正常',
          monitor.name,
          'recovery'
        );
        newStatus.failoverTriggered = false;
      }
    }
    
    status[monitor.id] = newStatus;
  }
  
  await saveStoredData(env, KEYS.MONITOR_STATUS, status);
}
