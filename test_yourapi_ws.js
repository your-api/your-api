const WebSocket = require('ws');

const urls = [
    'wss://yourapi.cn/v1/realtime',
    'wss://api3.yourapi.cn/v1/realtime',
];

const apiKey = 'sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V';

async function testWebSocket(url) {
    return new Promise((resolve) => {
        console.log(`\n🔍 测试: ${url}`);
        console.log('─'.repeat(50));
        
        const ws = new WebSocket(url + '?model=gpt-4o-realtime-preview', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'OpenAI-Beta': 'realtime=v1'
            },
            timeout: 5000
        });

        const timeout = setTimeout(() => {
            console.log('⏱️  连接超时');
            ws.terminate();
            resolve();
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            console.log('✅ WebSocket 连接成功！');
            
            // 发送测试消息
            const testMessage = {
                type: 'session.update',
                session: {
                    model: 'gpt-4o-realtime-preview',
                    modalities: ['text', 'audio'],
                    instructions: 'Test connection'
                }
            };
            
            console.log('📤 发送测试消息...');
            ws.send(JSON.stringify(testMessage));
            
            // 等待响应后关闭
            setTimeout(() => {
                ws.close();
                resolve();
            }, 2000);
        });

        ws.on('message', (data) => {
            const msg = data.toString();
            try {
                const parsed = JSON.parse(msg);
                console.log('📥 收到消息类型:', parsed.type);
                if (parsed.type === 'session.created') {
                    console.log('   Session ID:', parsed.session?.id);
                    console.log('   Model:', parsed.session?.model);
                }
            } catch (e) {
                console.log('📥 收到消息:', msg.substring(0, 100) + '...');
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error('❌ 错误:', error.message);
            resolve();
        });

        ws.on('close', (code, reason) => {
            clearTimeout(timeout);
            if (code !== 1000) {
                console.log(`🔌 连接关闭: code=${code}, reason=${reason || '无'}`);
            }
            resolve();
        });
    });
}

async function testHTTPS() {
    console.log('\n📡 测试 HTTPS 连接');
    console.log('═'.repeat(50));
    
    // 测试 API 端点
    try {
        const https = require('https');
        const testUrl = 'https://yourapi.cn/v1/models';
        
        https.get(testUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        }, (res) => {
            console.log(`✅ HTTPS 状态码: ${res.statusCode}`);
            console.log(`   响应头: ${JSON.stringify(res.headers['content-type'])}`);
        }).on('error', (e) => {
            console.error(`❌ HTTPS 错误: ${e.message}`);
        });
    } catch (e) {
        console.error('❌ 测试失败:', e.message);
    }
}

async function main() {
    console.log('🚀 开始测试 yourapi.cn WebSocket 连接');
    
    // 先测试 HTTPS
    await testHTTPS();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试 WebSocket
    for (const url of urls) {
        await testWebSocket(url);
    }
    
    console.log('\n✨ 测试完成');
}

main().catch(console.error);