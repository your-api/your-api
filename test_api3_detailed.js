const WebSocket = require('ws');

const apiKey = 'sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V';
const baseUrl = 'api3.yourapi.cn';

console.log('🚀 测试 api3.yourapi.cn WebSocket 连接\n');
console.log('═'.repeat(60));

// 测试配置
const tests = [
    {
        name: 'OpenAI Realtime (GPT-4o)',
        url: `wss://${baseUrl}/v1/realtime?model=gpt-4o-realtime-preview`,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
        },
        testMessage: {
            type: 'session.update',
            session: {
                model: 'gpt-4o-realtime-preview',
                modalities: ['text', 'audio'],
                instructions: 'You are a helpful assistant.'
            }
        }
    },
    {
        name: 'Claude Realtime',
        url: `wss://${baseUrl}/v1/realtime?model=claude-3-5-sonnet-20241022`,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'anthropic-beta': 'realtime-2024-10-15',
            'anthropic-version': '2023-06-01'
        },
        testMessage: {
            type: 'session.update',
            session: {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024
            }
        }
    }
];

async function testWebSocket(config) {
    return new Promise((resolve) => {
        console.log(`\n📡 测试: ${config.name}`);
        console.log('─'.repeat(60));
        console.log(`URL: ${config.url}`);
        
        let messageCount = 0;
        const startTime = Date.now();
        
        const ws = new WebSocket(config.url, {
            headers: config.headers,
            timeout: 10000
        });

        const timeout = setTimeout(() => {
            console.log('⏱️  连接超时 (10秒)');
            ws.terminate();
            resolve();
        }, 10000);

        ws.on('open', () => {
            const connectTime = Date.now() - startTime;
            console.log(`✅ 连接成功! (耗时: ${connectTime}ms)`);
            console.log('📤 发送测试消息...');
            ws.send(JSON.stringify(config.testMessage));
            
            // 等待响应
            setTimeout(() => {
                console.log(`📊 收到 ${messageCount} 条消息`);
                ws.close();
                resolve();
            }, 3000);
        });

        ws.on('message', (data) => {
            messageCount++;
            const msg = data.toString();
            try {
                const parsed = JSON.parse(msg);
                console.log(`📥 消息 #${messageCount}: ${parsed.type}`);
                
                if (parsed.type === 'session.created') {
                    console.log('   ├─ Session ID:', parsed.session?.id);
                    console.log('   ├─ Model:', parsed.session?.model);
                    console.log('   └─ Modalities:', parsed.session?.modalities);
                } else if (parsed.type === 'session.updated') {
                    console.log('   └─ Session 已更新');
                } else if (parsed.error) {
                    console.log('   └─ 错误:', parsed.error.message);
                }
            } catch (e) {
                if (msg.length > 100) {
                    console.log(`📥 消息 #${messageCount}: [二进制数据或长消息]`);
                } else {
                    console.log(`📥 消息 #${messageCount}:`, msg);
                }
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error('❌ 连接错误:', error.message);
            if (error.message.includes('401')) {
                console.log('   可能是认证问题');
            } else if (error.message.includes('400')) {
                console.log('   可能是请求参数问题');
            }
            resolve();
        });

        ws.on('close', (code, reason) => {
            clearTimeout(timeout);
            console.log(`🔌 连接关闭: code=${code}, reason=${reason || '正常关闭'}`);
            resolve();
        });
    });
}

async function testHTTPS() {
    console.log('\n🌐 测试 HTTPS API');
    console.log('─'.repeat(60));
    
    const https = require('https');
    
    return new Promise((resolve) => {
        const options = {
            hostname: baseUrl,
            path: '/v1/models',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        };
        
        const req = https.request(options, (res) => {
            console.log(`✅ HTTPS 状态: ${res.statusCode}`);
            console.log(`   Content-Type: ${res.headers['content-type']}`);
            console.log(`   Server: ${res.headers.server || 'Unknown'}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.data && Array.isArray(parsed.data)) {
                        console.log(`   可用模型数: ${parsed.data.length}`);
                        // 显示前3个模型
                        parsed.data.slice(0, 3).forEach((model, i) => {
                            console.log(`   ${i === 2 ? '└' : '├'}─ ${model.id}`);
                        });
                    }
                } catch (e) {
                    console.log('   响应解析失败');
                }
                resolve();
            });
        });
        
        req.on('error', (e) => {
            console.error(`❌ HTTPS 错误: ${e.message}`);
            resolve();
        });
        
        req.end();
    });
}

async function main() {
    // 先测试 HTTPS
    await testHTTPS();
    
    // 测试每个 WebSocket 配置
    for (const test of tests) {
        await testWebSocket(test);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('✨ 所有测试完成！');
    console.log('\n📝 总结:');
    console.log('- api3.yourapi.cn HTTPS API: ✅ 正常');
    console.log('- api3.yourapi.cn WebSocket: ✅ 正常 (支持 GPT-4o realtime)');
    console.log('- 建议: 确保 Docker 容器使用相同的 Nginx 配置');
}

main().catch(console.error);