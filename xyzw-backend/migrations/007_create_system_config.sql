CREATE TABLE IF NOT EXISTS system_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config (key, value, description) VALUES
    ('game_client_version', '"2.21.2-fa918e1997301834-wx"', '游戏客户端版本号'),
    ('game_ws_url', '"wss://xxz-xyzw.hortorgames.com/agent"', '游戏WS服务器地址'),
    ('game_login_url', '"https://xxz-xyzw.hortorgames.com/login/authuser"', '登录API地址'),
    ('game_platform_url', '"https://comb-platform.hortorgames.com"', '平台API地址'),
    ('protocol_healthy', 'true', '协议是否健康'),
    ('last_health_check', 'null', '最近一次健康检查时间')
ON CONFLICT (key) DO NOTHING;
