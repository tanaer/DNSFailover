// DNS Failover Worker for Cloudflare
// 存储键名常量
const KEYS = {
  API_CONFIGS: 'api_configs',
  FAILOVER_POLICIES: 'failover_policies',
  MONITORS: 'monitors',
  SWITCH_LOGS: 'switch_logs',
  MONITOR_STATUS: 'monitor_status',
  AUTH_SESSIONS: 'auth_sessions',
  NOTIFICATION_CHANNELS: 'notification_channels'
};

// 生成随机会话 ID
function generateSessionId() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// 获取登录页面
function getLoginHTML(siteKey, error = '') {
  const hasTurnstile = siteKey && siteKey.length > 0;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DNS Failover - 登录</title>
  ${hasTurnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .login-box { background: #fff; border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .login-box h1 { text-align: center; color: #333; margin-bottom: 10px; font-size: 24px; }
    .login-box p { text-align: center; color: #666; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
    .form-group input { width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; transition: border-color 0.3s; }
    .form-group input:focus { outline: none; border-color: #667eea; }
    .btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4); }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .error { background: #fee; color: #c00; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .turnstile-wrapper { display: flex; justify-content: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>🛡️ DNS Failover</h1>
    <p>请输入密码登录管理面板</p>
    ${error ? '<div class="error">' + error + '</div>' : ''}
    <form id="loginForm" method="POST" action="/auth/login">
      <div class="form-group">
        <label>密码</label>
        <input type="password" name="password" required placeholder="请输入管理密码" autofocus>
      </div>
      ${hasTurnstile ? '<div class="turnstile-wrapper"><div class="cf-turnstile" data-sitekey="' + siteKey + '" data-callback="onTurnstileSuccess"></div></div>' : ''}
      <button type="submit" class="btn" id="submitBtn" ${hasTurnstile ? 'disabled' : ''}>登 录</button>
    </form>
  </div>
  ${hasTurnstile ? '<script>function onTurnstileSuccess(token) { document.getElementById("submitBtn").disabled = false; }</script>' : ''}
</body>
</html>`;
}

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
    .loading-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 3000; }
    .loading-overlay.show { display: flex; }
    .loading-box { background: #fff; padding: 30px 50px; border-radius: 12px; text-align: center; }
    .loading-spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #4361ee; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    /* iOS 风格开关 */
    .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .switch .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 24px; }
    .switch .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .switch input:checked + .slider { background-color: #4361ee; }
    .switch input:checked + .slider:before { transform: translateX(20px); }
    /* 渠道选择器 */
    .channel-selector { display: flex; gap: 8px; flex-wrap: wrap; }
    .channel-selector .channel-btn { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; transition: all 0.2s; background: #fff; }
    .channel-selector .channel-btn:hover { border-color: #b0b0b0; background: #fafafa; }
    .channel-selector .channel-btn.selected { border-color: #4361ee; background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%); }
    .channel-selector .channel-btn input { display: none; }
    .channel-selector .channel-icon { font-size: 20px; }
    .channel-selector .channel-info { display: flex; flex-direction: column; }
    .channel-selector .channel-name { font-weight: 600; color: #333; font-size: 14px; }
    .channel-selector .channel-desc { font-size: 11px; color: #888; }
    .channel-selector .channel-btn.selected .channel-name { color: #4361ee; }
    .channel-selector .channel-check { width: 18px; height: 18px; border: 2px solid #ddd; border-radius: 50%; margin-left: auto; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .channel-selector .channel-btn.selected .channel-check { background: #4361ee; border-color: #4361ee; }
    .channel-selector .channel-btn.selected .channel-check:after { content: '✓'; color: #fff; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <!-- Loading 遮罩层 -->
  <div id="loading-overlay" class="loading-overlay">
    <div class="loading-box">
      <div class="loading-spinner"></div>
      <div id="loading-text">执行中，请稍候...</div>
    </div>
  </div>

  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h1>🛡️ DNS Failover 管理面板</h1>
      <button class="btn btn-secondary" onclick="logout()">退出登录</button>
    </div>
    
    <div class="tabs">
      <button class="tab active" data-panel="api-config">API 配置</button>
      <button class="tab" data-panel="failover-policy">Failover 策略</button>
      <button class="tab" data-panel="monitors">监控配置</button>
      <button class="tab" data-panel="notification-channel">通知渠道</button>
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

    <!-- 通知渠道面板 -->
    <div id="notification-channel" class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3>通知渠道列表</h3>
        <button class="btn btn-primary" onclick="showAddChannelModal()">+ 添加渠道</button>
      </div>
      <div id="channel-list"></div>
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
          <label>根域名</label>
          <input type="text" id="api-domain" required placeholder="例如: example.com">
          <small style="color:#666">该配置对应的根域名，用于自动匹配 Failover 策略中的域名</small>
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
          <textarea id="policy-domains" required rows="4" placeholder="www.example.com&#10;api.example.com&#10;cdn.example.com" oninput="validatePolicyDomains()"></textarea>
          <div id="policy-domains-validation" style="margin-top: 8px; font-size: 13px;"></div>
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
        <input type="hidden" id="policy-api-id">
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

  <!-- 通知渠道模态框 -->
  <div id="channel-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="channel-modal-title">添加通知渠道</h3>
        <button class="modal-close" onclick="closeModal('channel-modal')">&times;</button>
      </div>
      <form id="channel-form">
        <input type="hidden" id="channel-id">
        <div class="form-group">
          <label>渠道名称</label>
          <input type="text" id="channel-name" required placeholder="例如: 我的微信通知">
        </div>
        <div class="form-group">
          <label>API 域名</label>
          <input type="url" id="channel-api-url" required value="https://www.pushplus.plus" placeholder="https://www.pushplus.plus">
          <small style="color:#666">只需填写域名，系统自动使用 /send 接口</small>
        </div>
        <div class="form-group">
          <label>Token</label>
          <input type="text" id="channel-token" required placeholder="PushPlus 的 token">
        </div>
        <div class="form-group">
          <label style="margin-bottom: 10px;">发送渠道（可多选）</label>
          <div class="channel-selector" id="channel-types">
            <label class="channel-btn selected" onclick="toggleChannelBtn(this)">
              <input type="checkbox" name="channel-type" value="wechat" checked>
              <span class="channel-icon">📱</span>
              <div class="channel-info">
                <span class="channel-name">微信</span>
                <span class="channel-desc">微信公众号推送</span>
              </div>
              <span class="channel-check"></span>
            </label>
            <label class="channel-btn" onclick="toggleChannelBtn(this)">
              <input type="checkbox" name="channel-type" value="app">
              <span class="channel-icon">📲</span>
              <div class="channel-info">
                <span class="channel-name">APP</span>
                <span class="channel-desc">PushPlus App推送</span>
              </div>
              <span class="channel-check"></span>
            </label>
            <label class="channel-btn" onclick="toggleChannelBtn(this)">
              <input type="checkbox" name="channel-type" value="extension">
              <span class="channel-icon">🌐</span>
              <div class="channel-info">
                <span class="channel-name">浏览器扩展</span>
                <span class="channel-desc">浏览器插件推送</span>
              </div>
              <span class="channel-check"></span>
            </label>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-success" onclick="testChannel()">测试通知</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
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
    let channels = [];
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
      await Promise.all([loadApiConfigs(), loadPolicies(), loadMonitors(), loadChannels(), loadLogs(), loadStatus()]);
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
            <p>域名: \${api.domain || '未设置'}</p>
            <p>Zone ID: \${api.zoneId.substring(0, 8)}...</p>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-success btn-sm" onclick="testApiById('\${api.id}')">测试</button>
            <button class="btn btn-secondary btn-sm" onclick="copyApi('\${api.id}')">复制</button>
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

    function copyApi(id) {
      const api = apiConfigs.find(a => a.id === id);
      if (!api) return;
      document.getElementById('api-modal-title').textContent = '复制 API 配置';
      document.getElementById('api-id').value = ''; // 新ID，会在保存时自动生成
      document.getElementById('api-name').value = api.name + ' (复制)';
      document.getElementById('api-domain').value = ''; // 域名需要用户填写
      document.getElementById('api-zone-id').value = ''; // Zone ID 需要用户填写
      document.getElementById('api-token').value = api.token; // Token 复用
      showModal('api-modal');
    }

    function editApi(id) {
      const api = apiConfigs.find(a => a.id === id);
      if (!api) return;
      document.getElementById('api-modal-title').textContent = '编辑 API 配置';
      document.getElementById('api-id').value = api.id;
      document.getElementById('api-name').value = api.name;
      document.getElementById('api-domain').value = api.domain || '';
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
        domain: document.getElementById('api-domain').value.toLowerCase().trim(),
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

    // 获取域名的根域名
    function getRootDomain(domain) {
      // 移除通配符前缀
      domain = domain.replace(/^\\*\\./, '');
      const parts = domain.split('.');
      if (parts.length >= 2) {
        return parts.slice(-2).join('.');
      }
      return domain;
    }

    // 查找域名对应的 API 配置
    function findApiConfigForDomain(domain) {
      const rootDomain = getRootDomain(domain);
      return apiConfigs.find(api => api.domain && api.domain.toLowerCase() === rootDomain.toLowerCase());
    }

    // 验证策略域名
    function validatePolicyDomains() {
      const domainsText = document.getElementById('policy-domains').value;
      const domains = domainsText.split('\\n').map(d => d.trim()).filter(d => d);
      const validationDiv = document.getElementById('policy-domains-validation');
      
      if (domains.length === 0) {
        validationDiv.innerHTML = '';
        return;
      }
      
      let html = '';
      let allValid = true;
      
      for (const domain of domains) {
        const api = findApiConfigForDomain(domain);
        const rootDomain = getRootDomain(domain);
        if (api) {
          html += '<div style="color: #27ae60; margin: 2px 0;">✅ ' + domain + ' → ' + api.name + '</div>';
        } else {
          html += '<div style="color: #e74c3c; margin: 2px 0;">❌ ' + domain + ' → 未找到 "' + rootDomain + '" 的 API 配置，请先添加</div>';
          allValid = false;
        }
      }
      
      validationDiv.innerHTML = html;
      return allValid;
    }

    function showAddPolicyModal() {
      document.getElementById('policy-modal-title').textContent = '添加 Failover 策略';
      document.getElementById('policy-form').reset();
      document.getElementById('policy-id').value = '';
      document.getElementById('policy-ttl').value = '1';
      document.getElementById('policy-domains-validation').innerHTML = '';
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
      document.getElementById('policy-api-id').value = p.apiId || '';
      document.getElementById('policy-ttl').value = p.ttl || 1;
      document.getElementById('policy-proxied').value = String(p.proxied !== false);
      validatePolicyDomains();
      showModal('policy-modal');
    }

    document.getElementById('policy-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('policy-id').value || crypto.randomUUID();
      const domainsText = document.getElementById('policy-domains').value;
      const domains = domainsText.split('\\n').map(d => d.trim()).filter(d => d);
      
      // 验证所有域名都有对应的 API 配置
      const invalidDomains = domains.filter(d => !findApiConfigForDomain(d));
      if (invalidDomains.length > 0) {
        showToast('部分域名未配置 API，请先添加对应的 API 配置', 'error');
        return;
      }
      
      const data = {
        id,
        name: document.getElementById('policy-name').value,
        domains: domains,
        recordType: document.getElementById('policy-record-type').value,
        content: document.getElementById('policy-content').value,
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

    // Loading 控制
    function showLoading(text = '执行中，请稍候...') {
      document.getElementById('loading-text').textContent = text;
      document.getElementById('loading-overlay').classList.add('show');
    }
    function hideLoading() {
      document.getElementById('loading-overlay').classList.remove('show');
    }

    async function executePolicy(id) {
      if (!confirm('确定要立即执行此策略吗？这将修改DNS记录。')) return;
      showLoading('正在执行 DNS 切换...');
      try {
        const res = await fetch('/api/policies/' + id + '/execute', { method: 'POST' });
        const data = await res.json();
        hideLoading();
        if (data.success) {
          const msg = data.updated ? '策略执行成功！更新 ' + data.updated + ' 个域名' : '策略执行成功';
          showToast(msg);
          loadLogs();
        } else {
          showToast('执行失败: ' + data.error, 'error');
        }
      } catch (e) {
        hideLoading();
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
              <h4>\${m.name} \${statusHtml}</h4>
              <p>URL: \${m.url}</p>
              <p>间隔: \${m.interval}秒 | 失败阈值: \${m.failureThreshold}次 | 触发策略: \${policy ? policy.name : '未知'}</p>
            </div>
            <div class="list-item-actions" style="align-items: center;">
              <label class="switch" title="\${m.enabled !== false ? '点击禁用监控' : '点击启用监控'}">
                <input type="checkbox" \${m.enabled !== false ? 'checked' : ''} onchange="toggleMonitor('\${m.id}', this.checked)">
                <span class="slider"></span>
              </label>
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

    async function toggleMonitor(id, enabled) {
      const m = monitors.find(x => x.id === id);
      if (!m) return;
      m.enabled = enabled;
      try {
        await fetch('/api/monitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(m)
        });
        showToast(enabled ? '监控已启用' : '监控已禁用');
      } catch (e) {
        showToast('操作失败: ' + e.message, 'error');
        loadMonitors();
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

    // ========== 通知渠道 ==========
    async function loadChannels() {
      try {
        const res = await fetch('/api/channels');
        channels = await res.json();
        renderChannelList();
      } catch (e) {
        console.error('加载通知渠道失败', e);
      }
    }

    function renderChannelList() {
      const container = document.getElementById('channel-list');
      if (channels.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无通知渠道，请点击上方按钮添加</div>';
        return;
      }
      const channelTypeMap = { wechat: '微信', app: 'APP', extension: '浏览器扩展' };
      container.innerHTML = channels.map(c => {
        const types = Array.isArray(c.channelTypes) ? c.channelTypes : [c.channelType].filter(Boolean);
        const typesDisplay = types.map(t => channelTypeMap[t] || t).join(', ');
        return \`
          <div class="list-item">
            <div class="list-item-info" style="flex: 1;">
              <h4>\${c.name}</h4>
              <p>渠道: \${typesDisplay}</p>
              <p>API: \${c.apiUrl}</p>
              <p>Token: \${c.token.substring(0, 8)}...</p>
            </div>
            <div class="list-item-actions" style="align-items: center;">
              <label class="switch" title="\${c.enabled !== false ? '点击禁用' : '点击启用'}">
                <input type="checkbox" \${c.enabled !== false ? 'checked' : ''} onchange="toggleChannel('\${c.id}', this.checked)">
                <span class="slider"></span>
              </label>
              <button class="btn btn-success btn-sm" onclick="testChannelById('\${c.id}')">测试</button>
              <button class="btn btn-secondary btn-sm" onclick="editChannel('\${c.id}')">编辑</button>
              <button class="btn btn-danger btn-sm" onclick="deleteChannel('\${c.id}')">删除</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    async function toggleChannel(id, enabled) {
      const c = channels.find(x => x.id === id);
      if (!c) return;
      c.enabled = enabled;
      try {
        await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c)
        });
        showToast(enabled ? '已启用' : '已禁用');
      } catch (e) {
        showToast('操作失败: ' + e.message, 'error');
        loadChannels();
      }
    }

    function showAddChannelModal() {
      document.getElementById('channel-modal-title').textContent = '添加通知渠道';
      document.getElementById('channel-form').reset();
      document.getElementById('channel-id').value = '';
      document.getElementById('channel-api-url').value = 'https://www.pushplus.plus';
      // 重置多选框，默认选中微信
      document.querySelectorAll('#channel-types .channel-btn').forEach(btn => {
        const cb = btn.querySelector('input');
        cb.checked = cb.value === 'wechat';
        btn.classList.toggle('selected', cb.checked);
      });
      showModal('channel-modal');
    }

    function editChannel(id) {
      const c = channels.find(x => x.id === id);
      if (!c) return;
      document.getElementById('channel-modal-title').textContent = '编辑通知渠道';
      document.getElementById('channel-id').value = c.id;
      document.getElementById('channel-name').value = c.name;
      document.getElementById('channel-api-url').value = c.apiUrl;
      document.getElementById('channel-token').value = c.token;
      // 设置多选框
      const types = Array.isArray(c.channelTypes) ? c.channelTypes : [c.channelType].filter(Boolean);
      document.querySelectorAll('#channel-types .channel-btn').forEach(btn => {
        const cb = btn.querySelector('input');
        cb.checked = types.includes(cb.value);
        btn.classList.toggle('selected', cb.checked);
      });
      showModal('channel-modal');
    }

    function toggleChannelBtn(btn) {
      const cb = btn.querySelector('input');
      cb.checked = !cb.checked;
      btn.classList.toggle('selected', cb.checked);
    }

    function getSelectedChannelTypes() {
      return Array.from(document.querySelectorAll('#channel-types input:checked')).map(cb => cb.value);
    }

    async function testChannel() {
      const apiUrl = document.getElementById('channel-api-url').value;
      const token = document.getElementById('channel-token').value;
      const channelTypes = getSelectedChannelTypes();
      if (!apiUrl || !token) {
        showToast('请填写 API 域名和 Token', 'error');
        return;
      }
      if (channelTypes.length === 0) {
        showToast('请至少选择一个发送渠道', 'error');
        return;
      }
      showLoading('正在发送测试通知...');
      try {
        const res = await fetch('/api/channels/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiUrl, token, channelTypes })
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
          showToast('测试通知发送成功！请检查是否收到消息');
        } else {
          showToast('发送失败: ' + data.error, 'error');
        }
      } catch (e) {
        hideLoading();
        showToast('测试失败: ' + e.message, 'error');
      }
    }

    async function testChannelById(id) {
      showLoading('正在发送测试通知...');
      try {
        const res = await fetch('/api/channels/' + id + '/test', { method: 'POST' });
        const data = await res.json();
        hideLoading();
        if (data.success) {
          showToast('测试通知发送成功！请检查是否收到消息');
        } else {
          showToast('发送失败: ' + data.error, 'error');
        }
      } catch (e) {
        hideLoading();
        showToast('测试失败: ' + e.message, 'error');
      }
    }

    document.getElementById('channel-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const channelTypes = getSelectedChannelTypes();
      if (channelTypes.length === 0) {
        showToast('请至少选择一个发送渠道', 'error');
        return;
      }
      const id = document.getElementById('channel-id').value || crypto.randomUUID();
      // 编辑时保留原有的 enabled 状态，新建时默认启用
      const existingChannel = channels.find(c => c.id === id);
      const data = {
        id,
        name: document.getElementById('channel-name').value,
        apiUrl: document.getElementById('channel-api-url').value,
        token: document.getElementById('channel-token').value,
        channelTypes: channelTypes,
        enabled: existingChannel ? existingChannel.enabled : true
      };
      try {
        await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        showToast('保存成功');
        closeModal('channel-modal');
        loadChannels();
      } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
      }
    });

    async function deleteChannel(id) {
      if (!confirm('确定要删除这个通知渠道吗？')) return;
      try {
        await fetch('/api/channels/' + id, { method: 'DELETE' });
        showToast('删除成功');
        loadChannels();
      } catch (e) {
        showToast('删除失败: ' + e.message, 'error');
      }
    }

    async function logout() {
      try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.reload();
      } catch (e) {
        showToast('退出失败', 'error');
      }
    }
  </script>
</body>
</html>`;
}

// 验证 Turnstile token
async function verifyTurnstile(token, secretKey, ip) {
  if (!token) {
    return { success: false, error: '验证码未完成' };
  }
  
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const result = await response.json();
    if (result.success) {
      return { success: true };
    } else {
      const errorCodes = result['error-codes'] || [];
      return { success: false, error: errorCodes.join(', ') || '验证失败' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 检查会话是否有效
async function isAuthenticated(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return false;
  
  const sessionId = match[1];
  
  let sessions = {};
  try {
    const data = await env.KV.get(KEYS.AUTH_SESSIONS);
    if (data) {
      sessions = JSON.parse(data);
    }
  } catch (e) {
    console.error('isAuthenticated error:', e);
    return false;
  }
  
  const session = sessions[sessionId];
  if (!session) return false;
  
  // 会话 24 小时过期
  if (Date.now() - session.created > 24 * 60 * 60 * 1000) {
    delete sessions[sessionId];
    try {
      await env.KV.put(KEYS.AUTH_SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to delete expired session:', e);
    }
    return false;
  }
  return true;
}

// 主请求处理
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 获取配置
    const AUTH_PASSWORD = env.AUTH_PASSWORD || 'admin123';
    const TURNSTILE_SITE_KEY = env.TURNSTILE_SITE_KEY || '';
    const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY || '';

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
      // 登录页面
      if (path === '/auth/login' && method === 'GET') {
        return new Response(getLoginHTML(TURNSTILE_SITE_KEY), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // 登录处理
      if (path === '/auth/login' && method === 'POST') {
        const formData = await request.formData();
        const password = formData.get('password');
        const turnstileToken = formData.get('cf-turnstile-response');
        const ip = request.headers.get('CF-Connecting-IP') || '';

        // 验证 Turnstile（如果配置了）
        if (TURNSTILE_SECRET_KEY) {
          const turnstileResult = await verifyTurnstile(turnstileToken, TURNSTILE_SECRET_KEY, ip);
          if (!turnstileResult.success) {
            return new Response(getLoginHTML(TURNSTILE_SITE_KEY, '人机验证失败: ' + turnstileResult.error), {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        }

        // 验证密码
        if (password !== AUTH_PASSWORD) {
          return new Response(getLoginHTML(TURNSTILE_SITE_KEY, '密码错误'), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        // 创建会话
        const sessionId = generateSessionId();
        let sessions = {};
        try {
          const existingSessions = await env.KV.get(KEYS.AUTH_SESSIONS);
          if (existingSessions) {
            sessions = JSON.parse(existingSessions);
          }
        } catch (e) {
          console.error('Failed to get sessions:', e);
        }
        
        sessions[sessionId] = { created: Date.now(), ip };
        
        try {
          await env.KV.put(KEYS.AUTH_SESSIONS, JSON.stringify(sessions));
        } catch (e) {
          console.error('Failed to save session:', e);
          return new Response(getLoginHTML(TURNSTILE_SITE_KEY, '会话创建失败: ' + e.message), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        // 登录成功，返回管理页面并设置 Cookie
        return new Response(getHTML(), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
          }
        });
      }

      // 登出处理
      if (path === '/auth/logout' && method === 'POST') {
        const cookie = request.headers.get('Cookie') || '';
        const match = cookie.match(/session=([^;]+)/);
        if (match) {
          try {
            const data = await env.KV.get(KEYS.AUTH_SESSIONS);
            if (data) {
              const sessions = JSON.parse(data);
              delete sessions[match[1]];
              await env.KV.put(KEYS.AUTH_SESSIONS, JSON.stringify(sessions));
            }
          } catch (e) {
            console.error('Logout error:', e);
          }
        }
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/auth/login',
            'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0'
          }
        });
      }

      // 清理并重置会话存储（管理用）
      if (path === '/auth/reset' && method === 'POST') {
        await env.KV.delete(KEYS.AUTH_SESSIONS);
        return Response.json({ success: true, message: 'Sessions cleared' }, { headers: corsHeaders });
      }

      // 需要认证的路由
      const authenticated = await isAuthenticated(request, env);
      if (!authenticated) {
        // API 请求返回 401
        if (path.startsWith('/api/')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }
        // 页面请求重定向到登录页
        return new Response(null, {
          status: 302,
          headers: { 'Location': '/auth/login' }
        });
      }

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
        // apiConfig 传 null，executeFailoverPolicy 会自动根据域名查找
        const result = await executeFailoverPolicy(env, policy, null, '手动执行');
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

      // 通知渠道接口
      if (path === '/api/channels' && method === 'GET') {
        const channels = await getStoredData(env, KEYS.NOTIFICATION_CHANNELS);
        return Response.json(channels, { headers: corsHeaders });
      }

      if (path === '/api/channels' && method === 'POST') {
        const data = await request.json();
        const channels = await getStoredData(env, KEYS.NOTIFICATION_CHANNELS);
        const index = channels.findIndex(c => c.id === data.id);
        if (index >= 0) {
          channels[index] = data;
        } else {
          channels.push(data);
        }
        await saveStoredData(env, KEYS.NOTIFICATION_CHANNELS, channels);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/api/channels/test' && method === 'POST') {
        const { apiUrl, token, channelTypes } = await request.json();
        const types = Array.isArray(channelTypes) ? channelTypes : [channelTypes].filter(Boolean);
        const result = await sendPushPlusNotification(apiUrl, token, types, 'DNS Failover 测试通知', '这是一条测试通知，如果您收到此消息，说明通知配置正确。');
        return Response.json(result, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/channels\/[^/]+\/test$/) && method === 'POST') {
        const id = path.split('/')[3];
        const channels = await getStoredData(env, KEYS.NOTIFICATION_CHANNELS);
        const channel = channels.find(c => c.id === id);
        if (!channel) {
          return Response.json({ success: false, error: '通知渠道不存在' }, { headers: corsHeaders });
        }
        const types = Array.isArray(channel.channelTypes) ? channel.channelTypes : [channel.channelType].filter(Boolean);
        const result = await sendPushPlusNotification(channel.apiUrl, channel.token, types, 'DNS Failover 测试通知', '这是一条测试通知，如果您收到此消息，说明通知配置正确。');
        return Response.json(result, { headers: corsHeaders });
      }

      if (path.match(/^\/api\/channels\/[^/]+$/) && method === 'DELETE') {
        const id = path.split('/')[3];
        let channels = await getStoredData(env, KEYS.NOTIFICATION_CHANNELS);
        channels = channels.filter(c => c.id !== id);
        await saveStoredData(env, KEYS.NOTIFICATION_CHANNELS, channels);
        return Response.json({ success: true }, { headers: corsHeaders });
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
    if (!data) {
      // 返回对象的键
      if (key === KEYS.MONITOR_STATUS || key === KEYS.AUTH_SESSIONS) {
        return {};
      }
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('getStoredData error:', e);
    // 返回对象的键
    if (key === KEYS.MONITOR_STATUS || key === KEYS.AUTH_SESSIONS) {
      return {};
    }
    return [];
  }
}

async function saveStoredData(env, key, data) {
  await env.KV.put(key, JSON.stringify(data));
}

// 发送 PushPlus 通知（单渠道用 /send，多渠道用 /batchSend）
async function sendPushPlusNotification(apiBaseUrl, token, channelTypes, title, content) {
  try {
    const baseUrl = apiBaseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
    const types = Array.isArray(channelTypes) ? channelTypes : [channelTypes].filter(Boolean);
    
    if (types.length === 0) {
      return { success: false, error: '未选择发送渠道' };
    }
    
    if (types.length === 1) {
      // 单渠道使用 /send 接口
      const apiUrl = baseUrl + '/send';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          title: title,
          content: content,
          channel: types[0],
          template: 'html'
        })
      });
      const data = await response.json();
      if (data.code === 200) {
        return { success: true, sent: 1 };
      } else {
        return { success: false, error: data.msg || '发送失败' };
      }
    } else {
      // 多渠道需要分别发送
      const apiUrl = baseUrl + '/send';
      const errors = [];
      let successCount = 0;
      
      // 为每个渠道类型发送通知
      for (const channel of types) {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token,
              title: title,
              content: content,
              channel: channel,
              template: 'html'
            })
          });
          const data = await response.json();
          if (data.code === 200) {
            successCount++;
          } else {
            errors.push(channel + ': ' + (data.msg || '发送失败'));
          }
        } catch (e) {
          errors.push(channel + ': ' + e.message);
        }
      }
      
      if (successCount > 0) {
        return { success: true, sent: successCount, failed: errors.length };
      } else {
        return { success: false, error: errors.join('; ') || '发送失败' };
      }
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 发送所有启用的通知渠道
async function sendAllNotifications(env, title, content) {
  try {
    const channels = await getStoredData(env, KEYS.NOTIFICATION_CHANNELS);
    const enabledChannels = channels.filter(c => c.enabled !== false);
    
    const results = [];
    for (const channel of enabledChannels) {
      const types = Array.isArray(channel.channelTypes) ? channel.channelTypes : [channel.channelType].filter(Boolean);
      const result = await sendPushPlusNotification(channel.apiUrl, channel.token, types, title, content);
      results.push({
        name: channel.name,
        success: result.success,
        error: result.error
      });
    }
    return results;
  } catch (e) {
    console.error('sendAllNotifications error:', e);
    return [];
  }
}

// 构建通知内容
function buildNotificationContent(type, monitorName, policyName, domains, content, reason, successCount, errorCount) {
  const emoji = type === 'failover' ? '⚠️' : '✅';
  const typeText = type === 'failover' ? '故障切换' : '恢复切换';
  const domainsText = Array.isArray(domains) ? domains.join('<br>') : domains;
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px;">
      <h2 style="color: ${type === 'failover' ? '#e74c3c' : '#27ae60'}; margin-bottom: 15px;">${emoji} DNS ${typeText}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #666;">时间:</td><td style="padding: 8px 0;">${time}</td></tr>
        ${monitorName ? '<tr><td style="padding: 8px 0; color: #666;">监控:</td><td style="padding: 8px 0;">' + monitorName + '</td></tr>' : ''}
        <tr><td style="padding: 8px 0; color: #666;">策略:</td><td style="padding: 8px 0;">${policyName}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; vertical-align: top;">域名:</td><td style="padding: 8px 0;">${domainsText}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">目标:</td><td style="padding: 8px 0;">${content}</td></tr>
        ${reason ? '<tr><td style="padding: 8px 0; color: #666;">原因:</td><td style="padding: 8px 0;">' + reason + '</td></tr>' : ''}
      </table>
      ${successCount !== undefined ? '<p style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">执行结果: 成功 ' + successCount + ' 个，失败 ' + (errorCount || 0) + ' 个</p>' : ''}
    </div>
  `;
  return html;
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

// 获取域名的根域名
function getRootDomain(domain) {
  // 移除通配符前缀
  domain = domain.replace(/^\*\./, '');
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

// 根据域名查找对应的 API 配置
function findApiConfigForDomain(configs, domain) {
  const rootDomain = getRootDomain(domain);
  return configs.find(api => api.domain && api.domain.toLowerCase() === rootDomain.toLowerCase());
}

// 执行 Failover 策略
async function executeFailoverPolicy(env, policy, apiConfig, reason, monitorName = null, type = 'failover') {
  try {
    // 支持多域名，兼容旧版单域名格式
    const domains = Array.isArray(policy.domains) ? policy.domains : [policy.domain].filter(Boolean);
    const results = [];
    const errors = [];
    
    // 获取所有 API 配置
    const allApiConfigs = await getStoredData(env, KEYS.API_CONFIGS);

    for (const domain of domains) {
      try {
        // 自动查找该域名对应的 API 配置
        let currentApiConfig = findApiConfigForDomain(allApiConfigs, domain);
        
        // 如果找不到，回退到传入的 apiConfig（兼容旧版）
        if (!currentApiConfig && apiConfig) {
          currentApiConfig = apiConfig;
        }
        
        if (!currentApiConfig) {
          errors.push(`${domain}: 未找到对应的 API 配置`);
          continue;
        }
        
        // 获取 DNS 记录 ID
        const listResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${currentApiConfig.zoneId}/dns_records?name=${domain}&type=${policy.recordType}`,
          {
            headers: {
              'Authorization': `Bearer ${currentApiConfig.token}`,
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
            `https://api.cloudflare.com/client/v4/zones/${currentApiConfig.zoneId}/dns_records`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentApiConfig.token}`,
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
            `https://api.cloudflare.com/client/v4/zones/${currentApiConfig.zoneId}/dns_records/${recordId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${currentApiConfig.token}`,
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

    // 发送通知
    try {
      const notificationTitle = type === 'failover' ? '⚠️ DNS 故障切换通知' : '✅ DNS 恢复切换通知';
      const notificationContent = buildNotificationContent(
        type,
        policy.name,
        reason,
        results.length,
        errors.length
      );
      await sendAllNotifications(env, notificationTitle, notificationContent);
    } catch (notifyError) {
      console.error('发送通知失败:', notifyError);
    }

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
    // 条件：达到失败阈值 且 还没有触发过切换
    const shouldTriggerFailover = !result.healthy && 
      newStatus.failureCount >= monitor.failureThreshold && 
      !lastStatus.failoverTriggered;
    
    if (shouldTriggerFailover) {
      // 触发 Failover
      const policy = policies.find(p => p.id === monitor.policyId);
      
      if (policy) {
        // apiConfig 传 null，executeFailoverPolicy 会根据域名自动查找对应的 API 配置
        await executeFailoverPolicy(
          env, 
          policy, 
          null, 
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
      
      if (recoveryPolicy) {
        // apiConfig 传 null，executeFailoverPolicy 会根据域名自动查找对应的 API 配置
        await executeFailoverPolicy(
          env,
          recoveryPolicy,
          null,
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
