import React, { useEffect, useState, useRef } from 'react';
import {
  TextArea,
  Button,
  Col,
  Form,
  Popconfirm,
  Modal,
  Card,
  Row,
  Space,
  Spin,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import {useDispatch, useSelector} from "react-redux";
import {
  fetchAdvantages, fetchCustemNavLinks, fetchModelDiscriptions,
  fetchProviders,
  fetchTypingList,
  updateAdvantages, updateCustemNavLinks, updateModelDiscriptions,
  updateProviders, updateTypingList, fetchDiscountTiers, updateDiscountTiers
} from "../../../store/setting/providers.js";


export default function ModelRatioSettings(props) {
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    ModelPrice: '',
    ModelRatio: '',
    CacheRatio: '',
    CompletionRatio: '',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const { t } = useTranslation();
  const { providers = [], advantages = [],typingList = [],custemNavLinks=[],
    modelDiscriptions = {}, discountTiers = [] } = useSelector((state) => state.providers);
  const [providersJson, setProvidersJson] = useState(JSON.stringify(providers, null, 2));
  const [modelDiscriptionsJson, setModelDiscriptionsJson] = useState(JSON.stringify(modelDiscriptions, null, 2));
  const [advantagesJson, setAdvantagesJson] = useState(JSON.stringify(advantages, null, 2));
  const [typingListJson, setTypingListJson] = useState(JSON.stringify(typingList, null, 2));
  const [custemNavLinksJson, setCustemNavLinksJson] = useState(JSON.stringify(custemNavLinks, null, 2));
  const [discountTiersJson, setDiscountTiersJson] = useState(JSON.stringify(discountTiers, null, 2));

  // AI供应商数据
  const dispatch = useDispatch();
  useEffect(() => {
    if (providers.length === 0) {
      dispatch(fetchProviders());
    }
  }, [dispatch, providers.length]);

  useEffect(() => {
    if (advantages.length === 0) {
      dispatch(fetchAdvantages());
    }
  }, [dispatch, advantages.length]);

  useEffect(() => {
    if (typingList.length === 0) {
      dispatch(fetchTypingList());
    }
  }, [dispatch, typingList.length]);

  useEffect(() => {
    if (custemNavLinks.length === 0) {
      dispatch(fetchCustemNavLinks());
    }
  }, [dispatch, custemNavLinks.length]);

  useEffect(() => {
    if (discountTiers.length === 0) {
      dispatch(fetchDiscountTiers());
    }
  }, [dispatch, discountTiers.length]);

  useEffect(() => {
    dispatch(fetchModelDiscriptions());
  }, [dispatch]);

// Update JSON representation hooks - separate state updates
  useEffect(() => {
    setProvidersJson(JSON.stringify(providers, null, 2));
  }, [providers]);

  useEffect(() => {
    setAdvantagesJson(JSON.stringify(advantages, null, 2));
  }, [advantages]);

  useEffect(() => {
    setTypingListJson(JSON.stringify(typingList, null, 2));
  }, [typingList]);

  useEffect(() => {
    setCustemNavLinksJson(JSON.stringify(custemNavLinks, null, 2));
  }, [custemNavLinks]);

  useEffect(() => {
    setDiscountTiersJson(JSON.stringify(discountTiers, null, 2));
  }, [discountTiers]);

  useEffect(() => {
    setModelDiscriptionsJson(JSON.stringify(modelDiscriptions, null, 2));
    console.log("modelDiscriptions", modelDiscriptions);
  }, [modelDiscriptions]);


  async function saveProviders() {
    try {
      if (!verifyJSON(providersJson)) {
        return showError(t('不是合法的 JSON 字符串'));
      }

      setLoading(true);
      const parsedProviders = JSON.parse(providersJson);
      dispatch(updateProviders({ "Providers": parsedProviders }));
      showSuccess(t('供应商配置已更新'));
    } catch (error) {
      showError(t('保存失败') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveModelDiscriptions() {
    try {
      if (!verifyJSON(modelDiscriptionsJson)) {
        return showError(t('不是合法的 JSON 字符串'));
      }

      setLoading(true);
      const parsedModelDiscriptionsJson = JSON.parse(modelDiscriptionsJson);
      dispatch(updateModelDiscriptions({ "ModelDescriptions": parsedModelDiscriptionsJson }));
      showSuccess(t('模型描述设置已更新'));
    } catch (error) {
      showError(t('保存失败') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAdvantages() {
    try {
      if (!verifyJSON(advantagesJson)) {
        return showError(t('不是合法的 JSON 字符串'));
      }

      setLoading(true);
      const parsedAdvantages = JSON.parse(advantagesJson);
      dispatch(updateAdvantages({ "Advantages": parsedAdvantages }));
      showSuccess(t('供应商配置已更新'));
    } catch (error) {
      showError(t('保存失败') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveTypingList() {
    try {
      if (!verifyJSON(typingListJson)) {
        return showError(t('不是合法的 JSON 字符串'));
      }

      setLoading(true);
      const parsedTypingList = JSON.parse(typingListJson);
      dispatch(updateTypingList({ "TypingList": parsedTypingList }));
      showSuccess(t('首页打字机配置已更新'));
    } catch (error) {
      showError(t('保存失败') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveCustemNavLinksJson() {
    try {
      if (!verifyJSON(custemNavLinksJson)) {
        return showError(t('不是合法的 JSON 字符串'));
      }

      setLoading(true);
      const custemNavLinksList = JSON.parse(custemNavLinksJson);
      dispatch(updateCustemNavLinks({ "custemNavLinks": custemNavLinksList }));
      showSuccess(t('首页导航栏配置已更新'));
    } catch (error) {
      showError(t('保存失败') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDiscountTiers() {
    try {
      if (!verifyJSON(discountTiersJson)) {
        return showError(t('不是合法的 JSON 字符串'));
      }

      setLoading(true);
      const parsedDiscountTiers = JSON.parse(discountTiersJson);
      dispatch(updateDiscountTiers({ "UpdateDiscountTiers": parsedDiscountTiers }));
      showSuccess(t('折扣层级配置已更新'));
    } catch (error) {
      showError(t('保存失败') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    try {
      await refForm.current
        .validate()
        .then(() => {
          const updateArray = compareObjects(inputs, inputsRow);
          if (!updateArray.length)
            return showWarning(t('你似乎并没有修改什么'));

          const requestQueue = updateArray.map((item) => {
            const value =
              typeof inputs[item.key] === 'boolean'
                ? String(inputs[item.key])
                : inputs[item.key];
            return API.put('/api/option/', { key: item.key, value });
          });

          setLoading(true);
          Promise.all(requestQueue)
            .then((res) => {
              if (res.includes(undefined)) {
                return showError(
                  requestQueue.length > 1
                    ? t('部分保存失败，请重试')
                    : t('保存失败'),
                );
              }

              for (let i = 0; i < res.length; i++) {
                if (!res[i].data.success) {
                  return showError(res[i].data.message);
                }
              }

              showSuccess(t('保存成功'));
              props.refresh();
            })
            .catch((error) => {
              console.error('Unexpected error:', error);
              showError(t('保存失败，请重试'));
            })
            .finally(() => {
              setLoading(false);
            });
        })
        .catch(() => {
          showError(t('请检查输入'));
        });
    } catch (error) {
      showError(t('请检查输入'));
      console.error(error);
    }
  }

  async function resetModelRatio() {
    try {
      let res = await API.post(`/api/option/rest_model_ratio`);
      if (res.data.success) {
        showSuccess(res.data.message);
        props.refresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(error);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.TextArea
                label={t('模型固定价格')}
                extraText={t('一次调用消耗多少刀，优先级大于模型倍率')}
                placeholder={t(
                  '为一个 JSON 文本，键为模型名称，值为一次调用消耗多少刀，比如 "gpt-4-gizmo-*": 0.1，一次消耗0.1刀',
                )}
                field={'ModelPrice'}
                autosize={{ minRows: 6, maxRows: 12 }}
                trigger='blur'
                stopValidateWithError
                rules={[
                  {
                    validator: (rule, value) => verifyJSON(value),
                    message: '不是合法的 JSON 字符串',
                  },
                ]}
                onChange={(value) =>
                  setInputs({ ...inputs, ModelPrice: value })
                }
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.TextArea
                label={t('模型倍率')}
                placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
                field={'ModelRatio'}
                autosize={{ minRows: 6, maxRows: 12 }}
                trigger='blur'
                stopValidateWithError
                rules={[
                  {
                    validator: (rule, value) => verifyJSON(value),
                    message: '不是合法的 JSON 字符串',
                  },
                ]}
                onChange={(value) =>
                  setInputs({ ...inputs, ModelRatio: value })
                }
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.TextArea
                label={t('提示缓存倍率')}
                placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
                field={'CacheRatio'}
                autosize={{ minRows: 6, maxRows: 12 }}
                trigger='blur'
                stopValidateWithError
                rules={[
                  {
                    validator: (rule, value) => verifyJSON(value),
                    message: '不是合法的 JSON 字符串',
                  },
                ]}
                onChange={(value) =>
                  setInputs({ ...inputs, CacheRatio: value })
                }
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.TextArea
                label={t('模型补全倍率（仅对自定义模型有效）')}
                extraText={t('仅对自定义模型有效')}
                placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
                field={'CompletionRatio'}
                autosize={{ minRows: 6, maxRows: 12 }}
                trigger='blur'
                stopValidateWithError
                rules={[
                  {
                    validator: (rule, value) => verifyJSON(value),
                    message: '不是合法的 JSON 字符串',
                  },
                ]}
                onChange={(value) =>
                  setInputs({ ...inputs, CompletionRatio: value })
                }
              />
            </Col>
          </Row>
        </Form.Section>
      </Form>
      <Space>
        <Button onClick={onSubmit}>{t('保存模型倍率设置')}</Button>
        <Popconfirm
          title={t('确定重置模型倍率吗？')}
          content={t('此修改将不可逆')}
          okType={'danger'}
          position={'top'}
          onConfirm={resetModelRatio}
        >
          <Button type={'danger'}>{t('重置模型倍率')}</Button>
        </Popconfirm>
      </Space>








      <div style={{ marginBottom: 15 }}>
        <h4 style={{ marginBottom: 8 }}>{t('AI 供应商配置')}</h4>
        <div style={{ marginBottom: 8, fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
          {t('AI 供应商配置，用户模型过滤，以及图标展示')}
        </div>
        <TextArea
            value={providersJson}
            placeholder={t(
                '为一个 JSON 文本，键为模型名称，值为一次调用消耗多少刀，比如 "gpt-4-gizmo-*": 0.1，一次消耗0.1刀'
            )}
            autosize={{ minRows: 6, maxRows: 12 }}
            onChange={(value) =>
                setProvidersJson(value)
            }
            onBlur={(e) => {
              if (!verifyJSON(e.target.value)) {
                showError('不是合法的 JSON 字符串');
              }
            }}
            style={{ width: '100%', maxWidth: '100%' }}
        />
        <Space style={{ marginTop: 15 }}>
          <Button onClick={saveProviders}>{t('保存供应商设置')}</Button>
        </Space>
      </div>



      <div style={{ marginBottom: 15 }}>
        <h4 style={{ marginBottom: 8 }}>{t('模型描述设置')}</h4>
        <div style={{ marginBottom: 8, fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
          {t('{\n' +
              '  "gpt-4o": "GPT-4o是OpenAI最新推出的多模态模型，支持文本、图像和音频输入，适用于多种应用场景。",\n' +
              '  "gpt-4o-mini": "GPT-4o-Mini是OpenAI最新推出的多模态模型，支持文本、图像和音频输入，适用于多种应用场景。"\n' +
              '}')}
        </div>
        <TextArea
            value={modelDiscriptionsJson}
            placeholder={t(
                '为一个 JSON 文本，键为模型名称，值为一次调用消耗多少刀，比如 "gpt-4-gizmo-*": 0.1，一次消耗0.1刀'
            )}
            autosize={{ minRows: 6, maxRows: 12 }}
            onChange={(value) =>
                setModelDiscriptionsJson(value)
            }
            onBlur={(e) => {
              if (!verifyJSON(e.target.value)) {
                showError('不是合法的 JSON 字符串');
              }
            }}
            style={{ width: '100%', maxWidth: '100%' }}
        />
        <Space style={{ marginTop: 15 }}>
          <Button onClick={saveModelDiscriptions}>{t('保存模型描述设置')}</Button>
        </Space>
      </div>








      <div style={{ marginBottom: 15 }}>
        <h4 style={{ marginBottom: 8 }}>{t('首页优势特点配置')}</h4>
        <div style={{ marginBottom: 8, fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
          {t('首页优势特点配置')}
        </div>
        <TextArea
            value={advantagesJson}
            placeholder={t(
                '[\n' +
                '  {\n' +
                '    "id": "1",\n' +
                '    "title": "稳定快速",\n' +
                '    "description": "全球多机房API部署，API将会最近节点到达，为您的客户提高响应速度",\n' +
                '    "icon": "fa-star",\n' +
                '    "color": "rgb(147, 36, 244)"\n' +
                '  }\n' +
                ']'
            )}
            autosize={{ minRows: 6, maxRows: 12 }}
            onChange={(value) =>
                setAdvantagesJson(value)
            }
            onBlur={(e) => {
              if (!verifyJSON(e.target.value)) {
                showError('不是合法的 JSON 字符串');
              }
            }}
            style={{ width: '100%', maxWidth: '100%' }}
        />
        <Space style={{ marginTop: 15 }}>
          <Button onClick={saveAdvantages}>{t('保存首页优势特点配置')}</Button>
        </Space>
      </div>



      <div style={{ marginBottom: 15 }}>
        <h4 style={{ marginBottom: 8 }}>{t('首页打字机配置')}</h4>
        <div style={{ marginBottom: 8, fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
          {t('首页打字机配置')}
        </div>
        <TextArea
            value={typingListJson}
            placeholder={t(
                '[\n' +
                '  "赶上这趟列车",\n' +
                '  "开启AI新体验",\n' +
                '  "全面支持主流模型",\n' +
                '  "高性能 高颜值",\n' +
                '  "一站式AI解决方案"\n' +
                ']'
            )}
            autosize={{ minRows: 6, maxRows: 12 }}
            onChange={(value) =>
                setTypingListJson(value)
            }
            onBlur={(e) => {
              if (!verifyJSON(e.target.value)) {
                showError('不是合法的 JSON 字符串');
              }
            }}
            style={{ width: '100%', maxWidth: '100%' }}
        />
        <Space style={{ marginTop: 15 }}>
          <Button onClick={saveTypingList}>{t('保存首页打字机配置')}</Button>
        </Space>
      </div>



      <div style={{ marginBottom: 15 }}>
        <h4 style={{ marginBottom: 8 }}>{t('自定义导航配置')}</h4>
        <div style={{ marginBottom: 8, fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
          {t('自定义导航配置')}
        </div>
        <TextArea
            value={custemNavLinksJson}
            placeholder={t(
                '[\n' +
                '  {\n' +
                '    "text": "自定义导航（可在系统设置中配置）",\n' +
                '    "item_key": "custom",\n' +
                '    "url": "https://www.baidu.com"\n' +
                '  }\n' +
                ']'
            )}
            autosize={{ minRows: 6, maxRows: 12 }}
            onChange={(value) =>
                setCustemNavLinksJson(value)
            }
            onBlur={(e) => {
              if (!verifyJSON(e.target.value)) {
                showError('不是合法的 JSON 字符串');
              }
            }}
            style={{ width: '100%', maxWidth: '100%' }}
        />
        <Space style={{ marginTop: 15 }}>
          <Button onClick={saveCustemNavLinksJson}>{t('保存自定义导航配置')}</Button>
        </Space>
      </div>

      <div style={{ marginBottom: 15 }}>
        <h4 style={{ marginBottom: 8 }}>{t('折扣层级配置')}</h4>
        <div style={{ marginBottom: 8, fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
          {t('设置充值金额的折扣层级，MinAmount 为最小金额，Rate 为折扣比例（0.95表示95折）')}
        </div>
        <TextArea
            value={discountTiersJson}
            placeholder={t(
                '[\n' +
                '  {\n' +
                '    "MinAmount": 10,\n' +
                '    "Rate": 0.98\n' +
                '  },\n' +
                '  {\n' +
                '    "MinAmount": 99,\n' +
                '    "Rate": 0.96\n' +
                '  },\n' +
                '  {\n' +
                '    "MinAmount": 199,\n' +
                '    "Rate": 0.95\n' +
                '  }\n' +
                ']'
            )}
            autosize={{ minRows: 6, maxRows: 12 }}
            onChange={(value) =>
                setDiscountTiersJson(value)
            }
            onBlur={(e) => {
              if (!verifyJSON(e.target.value)) {
                showError('不是合法的 JSON 字符串');
              }
            }}
            style={{ width: '100%', maxWidth: '100%' }}
        />
        <Space style={{ marginTop: 15 }}>
          <Button onClick={saveDiscountTiers}>{t('保存折扣层级配置')}</Button>
        </Space>
      </div>








    </Spin>
  );
}
