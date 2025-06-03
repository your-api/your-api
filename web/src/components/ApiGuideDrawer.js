// src/components/ApiGuideDrawer.jsx
import React, { useMemo, useState, useEffect, useContext } from 'react';
import { SideSheet, Typography, Tabs, Divider, Button, Select } from '@douyinfe/semi-ui';
import {
  IconVerify,
  IconTerminal,
  IconCode,
  IconHelpCircle,
  IconCopy,
  IconClose,
  IconGlobe
} from '@douyinfe/semi-icons';
import { copy, showSuccess } from '../helpers';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/Theme';
import { StyleContext } from '../context/Style/index.js';

export default function ApiGuideDrawer({
                                         visible,
                                         onClose,
                                         baseUrl: propBaseUrl,
                                         modelId = 'deepseek/deepseek-prover-v2-671b'
                                       }) {
  const navigate = useNavigate();
  const { Title, Text, Paragraph } = Typography;
  const theme = useTheme(); // 使用useTheme钩子获取当前主题
  const isDarkMode = theme === 'dark';
  const [styleState, styleDispatch] = useContext(StyleContext);

  // API端点列表
  const apiEndpoints = [
    {
      label: '主API端点 - 香港直连',
      value: 'https://api.yourapi.cn',
      description: '稳定的主要API端点'
    },
    {
      label: '优质线路 - 亚太优化CDN',
      value: 'https://yourapi.cn',
      description: '亚太地区优化的CDN节点'
    },
    // {
    //   label: '优质线路 - CN2',
    //   value: 'https://cn2us02.opapi.win',
    //   description: 'CN2线路优化'
    // },
    // {
    //   label: '优质线路 - 备用',
    //   value: 'https://aigptx.top',
    //   description: '备用高速线路'
    // }
  ];

  // 选中的API端点状态
  const [selectedEndpoint, setSelectedEndpoint] = useState(apiEndpoints[0].value);

  // 动态计算 baseUrl（SSR 安全、去末尾斜杠、去掉最后一个 path segment）
  // const dynamicBase = useMemo(() => {
  //   if (typeof window === 'undefined') return '';
  //   const { origin, pathname } = window.location;
  //   const clean = pathname.split(/[?#]/)[0];
  //   const noSlash = clean.endsWith('/') && clean.length > 1
  //       ? clean.slice(0, -1)
  //       : clean;
  //   const parts = noSlash.split('/');
  //   parts.pop();
  //   const prefix = parts.length > 1 ? parts.join('/') : '';
  //   return origin + prefix;
  // }, []);
  //
  // // 最终 baseUrl：prop > dynamic > env > ''
  // const baseUrl = propBaseUrl
  //     || dynamicBase
  //     || process.env.REACT_APP_BASE_URL
  //     || '';

  // 使用选中的API端点
  const baseUrl = propBaseUrl || selectedEndpoint;

  // 衍生几个常用 URL
  const urlV1 = `${baseUrl}/v1`;
  const urlCompletions = `${baseUrl}/v1/chat/completions`;

  // 响应式：根据窗口宽度调整抽屉宽度和内边距
  const [sheetWidth, setSheetWidth] = useState('720px');
  const [bodyStyle, setBodyStyle] = useState({ padding: '24px 32px' });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setSheetWidth('100%');
        setBodyStyle({ padding: '16px' });
      } else if (w < 1024) {
        setSheetWidth('100%');
        setBodyStyle({ padding: '16px 24px' });
      } else {
        setSheetWidth('720px');
        setBodyStyle({ padding: '24px 32px' });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 各语言示例（请求都指向 /v1/chat/completions）
  const snippets = {
    curl: `curl "${urlCompletions}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{ "model":"${modelId}", "messages":[{"role":"user","content":"Hello!"}] }'`,
    python: `from openai import OpenAI

client = OpenAI(
  api_key="<YOUR_API_KEY>",
  base_url="${baseUrl}"
)

resp = client.chat.completions.create(
  model="${modelId}",
  messages=[{ role: "user", content: "Hello!" }]
)
print(resp.choices[0].message.content)`,
    javascript: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: "<YOUR_API_KEY>",
  baseURL: "${baseUrl}"
});

const res = await client.chat.completions.create({
  model: "${modelId}",
  messages: [{ role: "user", content: "Hello!" }]
});
console.log(res.choices[0].message.content);`,
    go: `package main

import (
  "context"
  "fmt"
  "github.com/sashabaranov/go-openai"
)

func main() {
  cfg := openai.DefaultConfig("<YOUR_API_KEY>")
  cfg.BaseURL = "${baseUrl}"
  client := openai.NewClientWithConfig(cfg)

  resp, err := client.CreateChatCompletion(
    context.Background(),
    openai.ChatCompletionRequest{
      Model: "${modelId}",
      Messages: []openai.ChatCompletionMessage{
        {Role: openai.ChatMessageRoleUser, Content: "Hello!"},
      },
    },
  )
  if err != nil {
    fmt.Println("Error:", err)
    return
  }
  fmt.Println(resp.Choices[0].Message.Content)
}`,
    java: `import okhttp3.*;
import org.json.JSONArray;
import org.json.JSONObject;

public class Main {
  public static void main(String[] args) throws Exception {
    String apiKey = "<YOUR_API_KEY>";
    String url = "${urlCompletions}";
    OkHttpClient client = new OkHttpClient();

    JSONObject payload = new JSONObject();
    payload.put("model", "${modelId}");
    JSONArray messages = new JSONArray();
    messages.put(new JSONObject().put("role", "user").put("content", "Hello!"));
    payload.put("messages", messages);

    Request request = new Request.Builder()
      .url(url)
      .addHeader("Content-Type", "application/json")
      .addHeader("Authorization", "Bearer " + apiKey)
      .post(RequestBody.create(payload.toString(), MediaType.get("application/json")))
      .build();

    try (Response response = client.newCall(request).execute()) {
      System.out.println(response.body().string());
    }
  }
}`,
    c: `#include <curl/curl.h>
#include <stdio.h>

int main(void) {
  CURL *curl = curl_easy_init();
  if (!curl) return 1;

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  headers = curl_slist_append(headers, "Authorization: Bearer <YOUR_API_KEY>");

  const char *data = "{ \\"model\\": \\"${modelId}\\", \\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Hello!\\"}] }";

  curl_easy_setopt(curl, CURLOPT_URL, "${urlCompletions}");
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data);

  CURLcode res = curl_easy_perform(curl);
  if (res != CURLE_OK) {
    fprintf(stderr, "curl error: %s\\n", curl_easy_strerror(res));
  }
  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);
  return 0;
}`
  };

  // 适配深色模式的样式
  const darkModeStyles = {
    // 整个抽屉
    drawerHeader: {
      background: isDarkMode ? 'var(--semi-color-bg-2)' : '#fff',
      borderBottom: `1px solid ${isDarkMode ? 'var(--semi-color-border)' : '#e8e8e8'}`,
      padding: '16px 24px'
    },
    drawerBody: {
      background: isDarkMode ? 'var(--semi-color-bg-2)' : '#fff',
      ...bodyStyle
    },
    // 基本信息区域
    infoCard: {
      backgroundColor: isDarkMode ? 'var(--semi-color-bg-1)' : '#f9fafb',
      borderColor: isDarkMode ? 'var(--semi-color-border)' : '#e5e7eb',
      color: isDarkMode ? 'var(--semi-color-text-0)' : 'inherit'
    },
    // 代码区域
    codeBlock: {
      backgroundColor: isDarkMode ? 'var(--semi-color-bg-1)' : '#f5f5f5',
      borderColor: isDarkMode ? 'var(--semi-color-border)' : '#e5e7eb',
      color: isDarkMode ? 'var(--semi-color-text-0)' : '#333'
    },
    // 帮助区域
    helpCard: {
      backgroundColor: isDarkMode ? 'var(--semi-color-bg-1)' : '#f9fafb',
      borderColor: isDarkMode ? 'var(--semi-color-border)' : '#e5e7eb',
      color: isDarkMode ? 'var(--semi-color-text-0)' : 'inherit'
    },
    // 文本颜色
    textPrimary: {
      color: isDarkMode ? 'var(--semi-color-text-0)' : '#333'
    },
    textSecondary: {
      color: isDarkMode ? 'var(--semi-color-text-1)' : '#666'
    },
    link: {
      color: isDarkMode ? 'var(--semi-color-link)' : '#2563eb'
    }
  };

  return (
      <SideSheet
          visible={visible}
          onCancel={onClose}
          width={sheetWidth}
          footer={null}
          closeIcon={<IconClose className="text-gray-400 hover:text-gray-600" />}
          headerStyle={darkModeStyles.drawerHeader}
          bodyStyle={darkModeStyles.drawerBody}
          title={
            <div className="flex items-center">
              <IconVerify className="text-blue-600 mr-2" />
              <span className="text-base sm:text-lg font-semibold" 
                    style={darkModeStyles.textPrimary}>
                API 接入指南
              </span>
            </div>
          }
      >
        <div className="space-y-8">
          {/* 基本信息 */}
          <section>
            <Title heading={3} 
                  className="flex items-center mb-4 text-base font-semibold" 
                  style={darkModeStyles.textPrimary}>
              <IconTerminal className="text-blue-600 mr-2" />
              基本信息
            </Title>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4" 
                style={darkModeStyles.infoCard}>
              
              {/* API端点选择器 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <IconGlobe className="text-blue-600" />
                  <Text style={darkModeStyles.textPrimary} strong>选择API端点:</Text>
                </div>
                <div className="flex items-center space-x-2">
                  <Select
                    value={selectedEndpoint}
                    onChange={setSelectedEndpoint}
                    style={{ flex: 1, minWidth: '0',minHeight: '50px' }}
                    placeholder="请选择API端点"
                    optionList={apiEndpoints.map(endpoint => ({
                      label: (
                        <div className="py-1">
                          <div style={darkModeStyles.textPrimary} className="font-medium">
                            {endpoint.label}
                          </div>
                          <div style={{ ...darkModeStyles.textSecondary, fontSize: '12px' }} className="mt-1">
                            {endpoint.description}
                          </div>
                        </div>
                      ),
                      value: endpoint.value
                    }))}
                    dropdownStyle={{ maxHeight: '300px' }}
                  />
                  <Button
                    size="small"
                    theme="borderless"
                    type="tertiary"
                    icon={<IconCopy />}
                    onClick={() => {
                      copy(selectedEndpoint);
                      showSuccess('已复制API端点');
                    }}
                    style={{ flexShrink: 0 }}
                  />
                </div>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* Base URL + Model ID rows */}
              {['当前Base URL:'].map((label, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Text style={darkModeStyles.textPrimary}>{label}</Text>
                    <div className="flex items-center space-x-2 max-w-full">
                      <Text link style={darkModeStyles.link} className="hover:underline break-all">
                        {baseUrl}
                      </Text>
                      <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<IconCopy />}
                          onClick={() => {
                            copy(baseUrl);
                            showSuccess(`已复制 ${label.replace(':','')}`);
                          }}
                      />
                    </div>
                  </div>
              ))}

              {/* API Key */}
              <div className="flex justify-between items-center">
                <Text style={darkModeStyles.textPrimary}>API Key:</Text>
                <Button size="small" theme="solid" type="primary" onClick={() => {
                  styleDispatch({ type: 'SET_SIDER', payload: true });
                  navigate('/token');
                }}>
                  创建 & 查询 API Key
                </Button>
              </div>

              {/* 不同客户端可用的 base_url */}
              <Divider style={{ margin: '16px 0' }} />

              <Text style={darkModeStyles.textPrimary} strong>基于当前端点的可用地址：</Text>
              
              {[
                { label: '根路径', url: baseUrl },
                { label: '版本化 (v1)', url: urlV1 },
                { label: '聊天接口', url: urlCompletions }
              ].map(({ label, url }) => (
                  <div key={label} className="flex justify-between items-center">
                    <Text style={darkModeStyles.textSecondary}>{label}:</Text>
                    <div className="flex items-center space-x-2 max-w-full">
                      <Text code className="break-all" style={darkModeStyles.textPrimary}>
                        {url}
                      </Text>
                      <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<IconCopy />}
                          onClick={() => {
                            copy(url);
                            showSuccess(`已复制 ${label}`);
                          }}
                      />
                    </div>
                  </div>
              ))}

              {/* 端点说明 */}
              <Divider style={{ margin: '16px 0' }} />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" 
                  style={{
                    backgroundColor: isDarkMode ? 'var(--semi-color-primary-light-default)' : '#eff6ff',
                    borderColor: isDarkMode ? 'var(--semi-color-primary)' : '#bfdbfe'
                  }}>
                <Text style={{ 
                  ...darkModeStyles.textPrimary, 
                  fontSize: '14px' 
                }}>
                  💡 <strong>端点选择建议：</strong>
                  {/*<br />• 中国大陆用户推荐选择"亚太优化CDN"或"CN2线路"获得更好的连接速度*/}
                  {/*<br />• 海外用户可选择"美国直连"获得最佳性能*/}
                  <br />• 如遇到连接问题，可尝试切换到其他备用线路
                </Text>
              </div>
            </div>
          </section>

          {/* 示例代码 */}
          <section>
            <Title heading={3} className="flex items-center mb-4 text-base font-semibold" 
                  style={darkModeStyles.textPrimary}>
              <IconCode className="text-blue-600 mr-2" />
              示例代码
            </Title>
            <Divider style={{ margin: '0 -32px' }} />
            <div className="overflow-x-auto">
              <Tabs type="line" size="large" className="min-w-[300px]">
                {Object.entries(snippets).map(([lang, code]) => (
                    <Tabs.TabPane tab={<span className="capitalize">{lang}</span>} itemKey={lang} key={lang}>
                      <div className="relative border rounded-lg p-4 font-mono text-sm overflow-x-auto"
                          style={darkModeStyles.codeBlock}>
                        <Button
                            size="small"
                            theme="borderless"
                            type="tertiary"
                            icon={<IconCopy />}
                            className="absolute top-3 right-3"
                            onClick={() => {
                              copy(code);
                              showSuccess('已复制代码');
                            }}
                        />
                        <pre className="whitespace-pre-wrap break-words">{code}</pre>
                      </div>
                    </Tabs.TabPane>
                ))}
              </Tabs>
            </div>
          </section>

          {/* 接入帮助 */}
          <section>
            <Title heading={3} className="flex items-center mb-4 text-base font-semibold" 
                  style={darkModeStyles.textPrimary}>
              <IconHelpCircle className="text-blue-600 mr-2" />
              接入帮助
            </Title>
            <div className="border rounded-lg p-6 space-y-6" 
                style={darkModeStyles.helpCard}>
              {[
                {
                  step: '1. 获取 API Key',
                  desc: (
                      <>
                        前往{' '}
                        <Text link style={darkModeStyles.link} className="hover:underline" onClick={() => {
                          styleDispatch({ type: 'SET_SIDER', payload: true });
                          navigate('/token');
                        }}>
                          令牌管理页面
                        </Text>{' '}
                        创建 API Key，用于接口认证。
                      </>
                  )
                },
                {
                  step: '2. 选择模型',
                  desc: (
                      <>
                        示例使用 <Text code style={darkModeStyles.textPrimary}>{modelId}</Text>，可替换为其他支持的模型 ID。
                      </>
                  )
                },
                {
                  step: '3. 发送请求',
                  desc: '使用上方示例代码，替换 <YOUR_API_KEY> 后即可快速调用。'
                },
                {
                  step: '4. 查看文档',
                  desc: (
                      <>
                        如需更多参数与示例，请参阅{' '}
                        <Text link style={darkModeStyles.link} className="hover:underline" onClick={() => {
                          styleDispatch({ type: 'SET_SIDER', payload: true });
                          navigate('/docs');
                        }}>
                          完整开发文档
                        </Text>
                        。
                      </>
                  )
                }
              ].map(({ step, desc }) => (
                  <div key={step}>
                    <Text strong style={darkModeStyles.textPrimary}>{step}</Text>
                    <Paragraph style={darkModeStyles.textSecondary} className="mt-1">{desc}</Paragraph>
                  </div>
              ))}
            </div>
          </section>
        </div>
      </SideSheet>
  );
}