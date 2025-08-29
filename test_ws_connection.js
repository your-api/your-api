const WebSocket = require('ws');

const url = 'ws://38.147.106.148:3001/v1/realtime';
const apiKey = 'sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V';

console.log('正在连接到 WebSocket:', url);

const ws = new WebSocket(url, {
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-beta': 'realtime-2024-10-15',
        'anthropic-version': '2023-06-01'
    }
});

ws.on('open', () => {
    console.log('✅ WebSocket 连接成功！');
    
    // 发送测试消息
    const testMessage = {
        type: 'session.update',
        session: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024
        }
    };
    
    console.log('发送测试消息:', JSON.stringify(testMessage, null, 2));
    ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
    console.log('收到消息:', data.toString());
});

ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`WebSocket 连接关闭: code=${code}, reason=${reason}`);
});

// 10秒后关闭连接
setTimeout(() => {
    console.log('主动关闭连接...');
    ws.close();
    process.exit(0);
}, 10000);