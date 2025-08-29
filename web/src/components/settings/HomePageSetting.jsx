import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Card,
  Col,
  Form,
  Row,
  Space,
  Spin,
  Typography,
  Tabs,
  TabPane,
  Modal,
  Table,
  Tag,
  Input,
  TextArea,
  Select,
  IconButton,
  Toast,
  List,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconEdit, IconSave } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, verifyJSON } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

export default function HomePageSetting() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('providers');
  const [options, setOptions] = useState({});
  const refForm = useRef();
  
  // 配置状态
  const [providers, setProviders] = useState([]);
  const [providersJson, setProvidersJson] = useState('[]');
  const [modelDescriptions, setModelDescriptions] = useState({});
  const [modelDescriptionsJson, setModelDescriptionsJson] = useState('{}');
  const [advantages, setAdvantages] = useState([]);
  const [advantagesJson, setAdvantagesJson] = useState('[]');
  const [typingList, setTypingList] = useState([]);
  const [typingListJson, setTypingListJson] = useState('[]');
  const [customNavLinks, setCustomNavLinks] = useState([]);
  const [customNavLinksJson, setCustomNavLinksJson] = useState('[]');
  const [discountTiers, setDiscountTiers] = useState([]);
  const [discountTiersJson, setDiscountTiersJson] = useState('[]');
  const [contactInfo, setContactInfo] = useState({});
  const [contactInfoJson, setContactInfoJson] = useState('{}');
  
  // 编辑模态框状态
  const [providerModalVisible, setProviderModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [advantageModalVisible, setAdvantageModalVisible] = useState(false);
  const [editingAdvantage, setEditingAdvantage] = useState(null);
  const [navLinkModalVisible, setNavLinkModalVisible] = useState(false);
  const [editingNavLink, setEditingNavLink] = useState(null);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);

  // 加载配置
  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      // 并行加载所有配置
      const [
        providersRes,
        advantagesRes,
        typingListRes,
        customNavLinksRes,
        discountTiersRes,
        modelDescRes,
        contactRes
      ] = await Promise.all([
        API.get('/api/option/getModelProviders'),
        API.get('/api/option/getAdvantages'),
        API.get('/api/option/getTypingList'),
        API.get('/api/option/getCustomNavLinks'),
        API.get('/api/option/getDiscountTiers'),
        API.get('/api/option/getModelDescriptions'),
        API.get('/api/contact')
      ]);

      // 设置providers
      if (providersRes.data.success && providersRes.data.data) {
        console.log('Loaded providers from API:', providersRes.data.data);
        setProviders(providersRes.data.data);
        setProvidersJson(JSON.stringify(providersRes.data.data, null, 2));
      }

      // 设置advantages
      if (advantagesRes.data.success && advantagesRes.data.data) {
        setAdvantages(advantagesRes.data.data);
        setAdvantagesJson(JSON.stringify(advantagesRes.data.data, null, 2));
      }

      // 设置typing list
      if (typingListRes.data.success && typingListRes.data.data) {
        setTypingList(typingListRes.data.data);
        setTypingListJson(JSON.stringify(typingListRes.data.data, null, 2));
      }

      // 设置custom nav links
      if (customNavLinksRes.data.success && customNavLinksRes.data.data) {
        setCustomNavLinks(customNavLinksRes.data.data);
        setCustomNavLinksJson(JSON.stringify(customNavLinksRes.data.data, null, 2));
      }

      // 设置discount tiers
      if (discountTiersRes.data.success && discountTiersRes.data.data) {
        setDiscountTiers(discountTiersRes.data.data);
        setDiscountTiersJson(JSON.stringify(discountTiersRes.data.data, null, 2));
      }

      // 设置model descriptions
      if (modelDescRes.data.success && modelDescRes.data.data) {
        setModelDescriptions(modelDescRes.data.data);
        setModelDescriptionsJson(JSON.stringify(modelDescRes.data.data, null, 2));
      }

      // 设置contact info
      if (contactRes.data.success && contactRes.data.data) {
        setContactInfo(contactRes.data.data);
        setContactInfoJson(JSON.stringify(contactRes.data.data, null, 2));
      }
    } catch (error) {
      showError('加载配置失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOption = async (key, value) => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : value,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('设置已更新'));
        await fetchOptions(); // 重新加载配置
      } else {
        showError(message || '更新失败');
      }
    } catch (error) {
      showError('更新失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('AI供应商配置')} itemKey="providers">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>供应商配置 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>直接编辑JSON数据配置供应商信息</Text>
            </div>
            <TextArea 
              value={providersJson}
              rows={20}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setProvidersJson(v);
                try {
                  const newProviders = JSON.parse(v);
                  setProviders(newProviders);
                } catch (e) {
                  // JSON格式错误，暂不处理
                }
              }}
            />
            <Space>
              <Button 
                type="primary" 
                icon={<IconSave />}
                onClick={() => {
                  try {
                    const parsedProviders = JSON.parse(providersJson);
                    if (Array.isArray(parsedProviders)) {
                      setProviders(parsedProviders);
                      updateOption('Providers', parsedProviders);
                      showSuccess('供应商配置已保存');
                    } else {
                      showError('JSON格式错误：必须是数组');
                    }
                  } catch (e) {
                    showError('JSON格式错误：' + e.message);
                  }
                }}
              >
                保存供应商配置
              </Button>
              <Button 
                onClick={() => {
                  // 格式化JSON
                  try {
                    const parsed = JSON.parse(providersJson);
                    setProvidersJson(JSON.stringify(parsed, null, 2));
                    showSuccess('JSON已格式化');
                  } catch (e) {
                    showError('JSON格式错误，无法格式化');
                  }
                }}
              >
                格式化JSON
              </Button>
              <Button 
                onClick={() => {
                  // 重置为原始数据
                  setProvidersJson(JSON.stringify(providers, null, 2));
                  showSuccess('已重置为最后保存的数据');
                }}
              >
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={t('模型描述')} itemKey="modelDescriptions">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>模型描述配置 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>为每个模型添加描述信息</Text>
            </div>
            <TextArea
              id="model-descriptions-input"
              value={modelDescriptionsJson}
              rows={20}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setModelDescriptionsJson(v);
                try {
                  const newDescriptions = JSON.parse(v);
                  setModelDescriptions(newDescriptions);
                } catch (e) {
                  // JSON格式错误，暂不处理
                }
              }}
              placeholder={t('例如：{"gpt-4": "最先进的GPT模型", "claude-3": "Anthropic的最新模型"}')}
            />
            <Space>
              <Button 
                type="primary"
                icon={<IconSave />} 
                onClick={() => {
                  try {
                    const parsed = JSON.parse(modelDescriptionsJson);
                    if (typeof parsed === 'object' && parsed !== null) {
                      setModelDescriptions(parsed);
                      updateOption('ModelDescriptions', parsed);
                      showSuccess('模型描述已保存');
                    } else {
                      showError('JSON格式错误：必须是对象');
                    }
                  } catch (e) {
                    showError('JSON格式错误：' + e.message);
                  }
                }}
              >
                {t('保存模型描述')}
              </Button>
              <Button 
                onClick={() => {
                  // 格式化JSON
                  try {
                    const parsed = JSON.parse(modelDescriptionsJson);
                    setModelDescriptionsJson(JSON.stringify(parsed, null, 2));
                    showSuccess('JSON已格式化');
                  } catch (e) {
                    showError('JSON格式错误，无法格式化');
                  }
                }}
              >
                格式化JSON
              </Button>
              <Button 
                onClick={() => {
                  // 重置为原始数据
                  setModelDescriptionsJson(JSON.stringify(modelDescriptions, null, 2));
                  showSuccess('已重置为最后保存的数据');
                }}
              >
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={t('首页优势')} itemKey="advantages">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>首页优势配置 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>配置首页展示的优势卡片</Text>
            </div>
            <TextArea
              value={advantagesJson}
              rows={15}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setAdvantagesJson(v);
                try {
                  const newAdvantages = JSON.parse(v);
                  setAdvantages(newAdvantages);
                } catch (e) {}
              }}
              placeholder={t('[{"id":1,"title":"优势标题","description":"优势描述","icon":"fa-rocket","color":"#1890ff"}]')}
            />
            <Space>
              <Button type="primary" icon={<IconSave />} onClick={() => {
                try {
                  const parsed = JSON.parse(advantagesJson);
                  if (Array.isArray(parsed)) {
                    setAdvantages(parsed);
                    updateOption('Advantages', parsed);
                    showSuccess('首页优势已保存');
                  } else {
                    showError('JSON格式错误：必须是数组');
                  }
                } catch (e) {
                  showError('JSON格式错误：' + e.message);
                }
              }}>
                {t('保存首页优势')}
              </Button>
              <Button onClick={() => {
                try {
                  const parsed = JSON.parse(advantagesJson);
                  setAdvantagesJson(JSON.stringify(parsed, null, 2));
                  showSuccess('JSON已格式化');
                } catch (e) {
                  showError('JSON格式错误');
                }
              }}>
                格式化JSON
              </Button>
              <Button onClick={() => {
                setAdvantagesJson(JSON.stringify(advantages, null, 2));
                showSuccess('已重置');
              }}>
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={t('打字机文本')} itemKey="typingList">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>打字机文本配置 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>配置首页打字机动画文本</Text>
            </div>
            <TextArea
              value={typingListJson}
              rows={10}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setTypingListJson(v);
                try {
                  const newTypingList = JSON.parse(v);
                  setTypingList(newTypingList);
                } catch (e) {}
              }}
              placeholder={t('["文本1", "文本2", "文本3"]')}
            />
            <Space>
              <Button type="primary" icon={<IconSave />} onClick={() => {
                try {
                  const parsed = JSON.parse(typingListJson);
                  if (Array.isArray(parsed)) {
                    setTypingList(parsed);
                    updateOption('TypingList', parsed);
                    showSuccess('打字机文本已保存');
                  } else {
                    showError('JSON格式错误：必须是数组');
                  }
                } catch (e) {
                  showError('JSON格式错误：' + e.message);
                }
              }}>
                {t('保存打字机文本')}
              </Button>
              <Button onClick={() => {
                try {
                  const parsed = JSON.parse(typingListJson);
                  setTypingListJson(JSON.stringify(parsed, null, 2));
                  showSuccess('JSON已格式化');
                } catch (e) {
                  showError('JSON格式错误');
                }
              }}>
                格式化JSON
              </Button>
              <Button onClick={() => {
                setTypingListJson(JSON.stringify(typingList, null, 2));
                showSuccess('已重置');
              }}>
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={t('自定义导航')} itemKey="customNavLinks">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>自定义导航链接 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>配置顶部导航栏的自定义链接</Text>
            </div>
            <TextArea
              value={customNavLinksJson}
              rows={10}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setCustomNavLinksJson(v);
                try {
                  const newNavLinks = JSON.parse(v);
                  setCustomNavLinks(newNavLinks);
                } catch (e) {}
              }}
              placeholder={t('[{"title":"链接名称","url":"https://example.com","target":"_blank"}]')}
            />
            <Space>
              <Button type="primary" icon={<IconSave />} onClick={() => {
                try {
                  const parsed = JSON.parse(customNavLinksJson);
                  if (Array.isArray(parsed)) {
                    setCustomNavLinks(parsed);
                    updateOption('CustomNavLinks', parsed);
                    showSuccess('自定义导航已保存');
                  } else {
                    showError('JSON格式错误：必须是数组');
                  }
                } catch (e) {
                  showError('JSON格式错误：' + e.message);
                }
              }}>
                {t('保存自定义导航')}
              </Button>
              <Button onClick={() => {
                try {
                  const parsed = JSON.parse(customNavLinksJson);
                  setCustomNavLinksJson(JSON.stringify(parsed, null, 2));
                  showSuccess('JSON已格式化');
                } catch (e) {
                  showError('JSON格式错误');
                }
              }}>
                格式化JSON
              </Button>
              <Button onClick={() => {
                setCustomNavLinksJson(JSON.stringify(customNavLinks, null, 2));
                showSuccess('已重置');
              }}>
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={t('折扣层级')} itemKey="discountTiers">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>折扣层级配置 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>配置不同充值金额的折扣率</Text>
            </div>
            <TextArea
              value={discountTiersJson}
              rows={15}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setDiscountTiersJson(v);
                try {
                  const newDiscountTiers = JSON.parse(v);
                  setDiscountTiers(newDiscountTiers);
                } catch (e) {}
              }}
              placeholder={t('[{"min_amount":10,"rate":0.99,"expire_time":1949949956}]')}
            />
            <Space>
              <Button type="primary" icon={<IconSave />} onClick={() => {
                try {
                  const parsed = JSON.parse(discountTiersJson);
                  if (Array.isArray(parsed)) {
                    setDiscountTiers(parsed);
                    updateOption('DiscountTiers', parsed);
                    showSuccess('折扣层级已保存');
                  } else {
                    showError('JSON格式错误：必须是数组');
                  }
                } catch (e) {
                  showError('JSON格式错误：' + e.message);
                }
              }}>
                {t('保存折扣层级')}
              </Button>
              <Button onClick={() => {
                try {
                  const parsed = JSON.parse(discountTiersJson);
                  setDiscountTiersJson(JSON.stringify(parsed, null, 2));
                  showSuccess('JSON已格式化');
                } catch (e) {
                  showError('JSON格式错误');
                }
              }}>
                格式化JSON
              </Button>
              <Button onClick={() => {
                setDiscountTiersJson(JSON.stringify(discountTiers, null, 2));
                showSuccess('已重置');
              }}>
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={t('联系方式')} itemKey="contactInfo">
          <Card>
            <div style={{ marginBottom: 10 }}>
              <Text strong>联系方式配置 (JSON格式)</Text>
              <Text type="secondary" style={{ marginLeft: 10 }}>配置网站联系信息</Text>
            </div>
            <TextArea
              value={contactInfoJson}
              rows={15}
              style={{ fontFamily: 'monospace', marginBottom: 16 }}
              onChange={(v) => {
                setContactInfoJson(v);
                try {
                  const newContactInfo = JSON.parse(v);
                  setContactInfo(newContactInfo);
                } catch (e) {}
              }}
              placeholder={t('{"ContactEmail":"","ContactPhone":"","ContactQQ":"","ContactWeChat":"","ContactTelegram":"","ContactAddress":"","ContactWorkTime":""}')}
            />
            <Space>
              <Button type="primary" icon={<IconSave />} onClick={() => {
                try {
                  const parsed = JSON.parse(contactInfoJson);
                  if (typeof parsed === 'object' && parsed !== null) {
                    setContactInfo(parsed);
                    // 联系方式的API不同，需要特殊处理
                    API.put('/api/contact', parsed).then(res => {
                      if (res.data.success) {
                        showSuccess('联系方式已保存');
                      } else {
                        showError(res.data.message || '保存失败');
                      }
                    }).catch(e => {
                      showError('保存失败：' + e.message);
                    });
                  } else {
                    showError('JSON格式错误：必须是对象');
                  }
                } catch (e) {
                  showError('JSON格式错误：' + e.message);
                }
              }}>
                {t('保存联系方式')}
              </Button>
              <Button onClick={() => {
                try {
                  const parsed = JSON.parse(contactInfoJson);
                  setContactInfoJson(JSON.stringify(parsed, null, 2));
                  showSuccess('JSON已格式化');
                } catch (e) {
                  showError('JSON格式错误');
                }
              }}>
                格式化JSON
              </Button>
              <Button onClick={() => {
                setContactInfoJson(JSON.stringify(contactInfo, null, 2));
                showSuccess('已重置');
              }}>
                重置
              </Button>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </Spin>
  );
}