import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  Typography,
  Banner,
  Tabs,
  TabPane,
  Card,
  Input,
  InputNumber,
  Switch,
  TextArea,
  Row,
  Col,
  Divider,
} from '@douyinfe/semi-ui';
import {
  IconCode,
  IconPlus,
  IconDelete,
  IconRefresh,
} from '@douyinfe/semi-icons';

const { Text } = Typography;

const JSONEditor = ({
  value = '',
  onChange,
  field,
  label,
  placeholder,
  extraText,
  extraFooter,
  showClear = true,
  template,
  templateLabel,
  editorType = 'keyValue',
  rules = [],
  formApi = null,
  ...props
}) => {
  const { t } = useTranslation();

  // 初始化JSON数据
  const [jsonData, setJsonData] = useState(() => {
    // 初始化时解析JSON数据
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return parsed;
      } catch (error) {
        return {};
      }
    }
    if (typeof value === 'object' && value !== null) {
      return value;
    }
    return {};
  });

  // 手动模式下的本地文本缓冲，避免无效 JSON 时被外部值重置
  const [manualText, setManualText] = useState(() => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
    return '';
  });

  // 根据键数量决定默认编辑模式
  const [editMode, setEditMode] = useState(() => {
    // 如果初始JSON数据的键数量大于10个，则默认使用手动模式
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        const keyCount = Object.keys(parsed).length;
        return keyCount > 10 ? 'manual' : 'visual';
      } catch (error) {
        // JSON无效时默认显示手动编辑模式
        return 'manual';
      }
    }
    return 'visual';
  });
  const [jsonError, setJsonError] = useState('');

  // 数据同步 - 当value变化时总是更新jsonData（如果JSON有效）
  useEffect(() => {
    try {
      let parsed = {};
      if (typeof value === 'string' && value.trim()) {
        parsed = JSON.parse(value);
      } else if (typeof value === 'object' && value !== null) {
        parsed = value;
      }
      setJsonData(parsed);
      setJsonError('');
    } catch (error) {
      console.log('JSON解析失败:', error.message);
      setJsonError(error.message);
      // JSON格式错误时不更新jsonData
    }
  }, [value]);

  // 外部 value 变化时，若不在手动模式，则同步手动文本；在手动模式下不打断用户输入
  useEffect(() => {
    if (editMode !== 'manual') {
      if (typeof value === 'string') setManualText(value);
      else if (value && typeof value === 'object') setManualText(JSON.stringify(value, null, 2));
      else setManualText('');
    }
  }, [value, editMode]);

  // 处理可视化编辑的数据变化
  const handleVisualChange = useCallback((newData) => {
    setJsonData(newData);
    setJsonError('');
    const jsonString = Object.keys(newData).length === 0 ? '' : JSON.stringify(newData, null, 2);

    // 通过formApi设置值（如果提供的话）
    if (formApi && field) {
      formApi.setValue(field, jsonString);
    }

    onChange?.(jsonString);
  }, [onChange, formApi, field]);

  // 处理手动编辑的数据变化（无效 JSON 不阻断输入，也不立刻回传上游）
  const handleManualChange = useCallback((newValue) => {
    setManualText(newValue);
    if (newValue && newValue.trim()) {
      try {
        JSON.parse(newValue);
        setJsonError('');
        onChange?.(newValue);
      } catch (error) {
        setJsonError(error.message);
        // 无效 JSON 时不回传，避免外部值把输入重置
      }
    } else {
      setJsonError('');
      onChange?.('');
    }
  }, [onChange]);

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    if (editMode === 'visual') {
      // 从可视化模式切换到手动模式
      setManualText(Object.keys(jsonData).length === 0 ? '' : JSON.stringify(jsonData, null, 2));
      setEditMode('manual');
    } else {
      // 从手动模式切换到可视化模式，需要验证JSON
      try {
        let parsed = {};
        if (manualText && manualText.trim()) {
          parsed = JSON.parse(manualText);
        } else if (typeof value === 'string' && value.trim()) {
          parsed = JSON.parse(value);
        } else if (typeof value === 'object' && value !== null) {
          parsed = value;
        }
        setJsonData(parsed);
        setJsonError('');
        setEditMode('visual');
      } catch (error) {
        setJsonError(error.message);
        // JSON格式错误时不切换模式
        return;
      }
    }
  }, [editMode, value, manualText, jsonData]);

  // 添加键值对
  const addKeyValue = useCallback(() => {
    const newData = { ...jsonData };
    const keys = Object.keys(newData);
    let counter = 1;
    let newKey = `field_${counter}`;
    while (newData.hasOwnProperty(newKey)) {
      counter += 1;
      newKey = `field_${counter}`;
    }
    newData[newKey] = '';
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 删除键值对
  const removeKeyValue = useCallback((keyToRemove) => {
    const newData = { ...jsonData };
    delete newData[keyToRemove];
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 更新键名
  const updateKey = useCallback((oldKey, newKey) => {
    if (oldKey === newKey || !newKey) return;
    const newData = {};
    Object.entries(jsonData).forEach(([k, v]) => {
      if (k === oldKey) {
        newData[newKey] = v;
      } else {
        newData[k] = v;
      }
    });
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 更新值
  const updateValue = useCallback((key, newValue) => {
    const newData = { ...jsonData };
    newData[key] = newValue;
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 填入模板
  const fillTemplate = useCallback(() => {
    if (template) {
      const templateString = JSON.stringify(template, null, 2);

      // 通过formApi设置值（如果提供的话）
      if (formApi && field) {
        formApi.setValue(field, templateString);
      }

      // 同步内部与外部值，避免出现杂字符
      setManualText(templateString);
      setJsonData(template);
      onChange?.(templateString);

      // 清除错误状态
      setJsonError('');
    }
  }, [template, onChange, editMode, formApi, field]);

  // 渲染键值对编辑器
  const renderKeyValueEditor = () => {
    if (typeof jsonData !== 'object' || jsonData === null) {
      return (
        <div className="text-center py-6 px-4">
          <div className="text-gray-400 mb-2">
            <IconCode size={32} />
          </div>
          <Text type="tertiary" className="text-gray-500 text-sm">
            {t('无效的JSON数据，请检查格式')}
          </Text>
        </div>
      );
    }
    const entries = Object.entries(jsonData);

    return (
      <div className="space-y-1">
        {entries.length === 0 && (
          <div className="text-center py-6 px-4">
            <Text type="tertiary" className="text-gray-500 text-sm">
              {t('暂无数据，点击下方按钮添加键值对')}
            </Text>
          </div>
        )}

        {entries.map(([key, value], index) => (
          <Row key={index} gutter={8} align="middle">
            <Col span={6}>
              <Input
                placeholder={t('键名')}
                value={key}
                onChange={(newKey) => updateKey(key, newKey)}
              />
            </Col>
            <Col span={16}>
              {renderValueInput(key, value)}
            </Col>
            <Col span={2}>
              <Button
                icon={<IconDelete />}
                type="danger"
                theme="borderless"
                onClick={() => removeKeyValue(key)}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        ))}

        <div className="mt-2 flex justify-center">
          <Button
            icon={<IconPlus />}
            type="primary"
            theme="outline"
            onClick={addKeyValue}
          >
            {t('添加键值对')}
          </Button>
        </div>
      </div>
    );
  };

  // 添加嵌套对象
  const flattenObject = useCallback((parentKey) => {
    const newData = { ...jsonData };
    let primitive = '';
    const obj = newData[parentKey];
    if (obj && typeof obj === 'object') {
      const firstKey = Object.keys(obj)[0];
      if (firstKey !== undefined) {
        const firstVal = obj[firstKey];
        if (typeof firstVal !== 'object') primitive = firstVal;
      }
    }
    newData[parentKey] = primitive;
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  const addNestedObject = useCallback((parentKey) => {
    const newData = { ...jsonData };
    if (typeof newData[parentKey] !== 'object' || newData[parentKey] === null) {
      newData[parentKey] = {};
    }
    const existingKeys = Object.keys(newData[parentKey]);
    let counter = 1;
    let newKey = `field_${counter}`;
    while (newData[parentKey].hasOwnProperty(newKey)) {
      counter += 1;
      newKey = `field_${counter}`;
    }
    newData[parentKey][newKey] = '';
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 渲染参数值输入控件（支持嵌套）
  const renderValueInput = (key, value) => {
    const valueType = typeof value;

    if (valueType === 'boolean') {
      return (
        <div className="flex items-center">
          <Switch
            checked={value}
            onChange={(newValue) => updateValue(key, newValue)}
          />
          <Text type="tertiary" className="ml-2">
            {value ? t('true') : t('false')}
          </Text>
        </div>
      );
    }

    if (valueType === 'number') {
      return (
        <InputNumber
          value={value}
          onChange={(newValue) => updateValue(key, newValue)}
          style={{ width: '100%' }}
          step={key === 'temperature' ? 0.1 : 1}
          precision={key === 'temperature' ? 2 : 0}
          placeholder={t('输入数字')}
        />
      );
    }

    if (valueType === 'object' && value !== null) {
      // 渲染嵌套对象
      const entries = Object.entries(value);
      return (
        <Card className="!rounded-2xl">
          {entries.length === 0 && (
            <Text type="tertiary" className="text-gray-500 text-xs">
              {t('空对象，点击下方加号添加字段')}
            </Text>
          )}

          {entries.map(([nestedKey, nestedValue], index) => (
            <Row key={index} gutter={4} align="middle" className="mb-1">
              <Col span={8}>
                <Input
                  size="small"
                  placeholder={t('键名')}
                  value={nestedKey}
                  onChange={(newKey) => {
                    const newData = { ...jsonData };
                    const oldValue = newData[key][nestedKey];
                    delete newData[key][nestedKey];
                    newData[key][newKey] = oldValue;
                    handleVisualChange(newData);
                  }}
                />
              </Col>
              <Col span={14}>
                {typeof nestedValue === 'object' && nestedValue !== null ? (
                  <TextArea
                    size="small"
                    rows={2}
                    value={JSON.stringify(nestedValue, null, 2)}
                    onChange={(txt) => {
                      try {
                        const obj = txt.trim() ? JSON.parse(txt) : {};
                        const newData = { ...jsonData };
                        newData[key][nestedKey] = obj;
                        handleVisualChange(newData);
                      } catch {
                        // ignore parse error
                      }
                    }}
                  />
                ) : (
                  <Input
                    size="small"
                    placeholder={t('值')}
                    value={String(nestedValue)}
                    onChange={(newValue) => {
                      const newData = { ...jsonData };
                      let convertedValue = newValue;
                      if (newValue === 'true') convertedValue = true;
                      else if (newValue === 'false') convertedValue = false;
                      else if (!isNaN(newValue) && newValue !== '' && newValue !== '0') {
                        convertedValue = Number(newValue);
                      }
                      newData[key][nestedKey] = convertedValue;
                      handleVisualChange(newData);
                    }}
                  />
                )}
              </Col>
              <Col span={2}>
                <Button
                  size="small"
                  icon={<IconDelete />}
                  type="danger"
                  theme="borderless"
                  onClick={() => {
                    const newData = { ...jsonData };
                    delete newData[key][nestedKey];
                    handleVisualChange(newData);
                  }}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          ))}

          <div className="flex justify-center mt-1 gap-2">
            <Button
              size="small"
              icon={<IconPlus />}
              type="tertiary"
              onClick={() => addNestedObject(key)}
            >
              {t('添加字段')}
            </Button>
            <Button
              size="small"
              icon={<IconRefresh />}
              type="tertiary"
              onClick={() => flattenObject(key)}
            >
              {t('转换为值')}
            </Button>
          </div>
        </Card>
      );
    }

    // 字符串或其他原始类型
    return (
      <div className="flex items-center gap-1">
        <Input
          placeholder={t('参数值')}
          value={String(value)}
          onChange={(newValue) => {
            let convertedValue = newValue;
            if (newValue === 'true') convertedValue = true;
            else if (newValue === 'false') convertedValue = false;
            else if (!isNaN(newValue) && newValue !== '' && newValue !== '0') {
              convertedValue = Number(newValue);
            }
            updateValue(key, convertedValue);
          }}
        />
        <Button
          icon={<IconPlus />}
          type="tertiary"
          onClick={() => {
            // 将当前值转换为对象
            const newData = { ...jsonData };
            newData[key] = { '1': value };
            handleVisualChange(newData);
          }}
          title={t('转换为对象')}
        />
      </div>
    );
  };

  // 渲染区域编辑器（特殊格式）
  const renderRegionEditor = () => {
    const entries = Object.entries(jsonData);
    const defaultEntry = entries.find(([key]) => key === 'default');
    const modelEntries = entries.filter(([key]) => key !== 'default');

    return (
      <div className="space-y-2">
        {/* 默认区域 */}
        <Form.Slot label={t('默认区域')}>
          <Input
            placeholder={t('默认区域，如: us-central1')}
            value={defaultEntry ? defaultEntry[1] : ''}
            onChange={(value) => updateValue('default', value)}
          />
        </Form.Slot>

        {/* 模型专用区域 */}
        <Form.Slot label={t('模型专用区域')}>
          <div>
            {modelEntries.map(([modelName, region], index) => (
              <Row key={index} gutter={8} align="middle" className="mb-2">
                <Col span={10}>
                  <Input
                    placeholder={t('模型名称')}
                    value={modelName}
                    onChange={(newKey) => updateKey(modelName, newKey)}
                  />
                </Col>
                <Col span={12}>
                  <Input
                    placeholder={t('区域')}
                    value={region}
                    onChange={(newValue) => updateValue(modelName, newValue)}
                  />
                </Col>
                <Col span={2}>
                  <Button
                    icon={<IconDelete />}
                    type="danger"
                    theme="borderless"
                    onClick={() => removeKeyValue(modelName)}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
            ))}

            <div className="mt-2 flex justify-center">
              <Button
                icon={<IconPlus />}
                onClick={addKeyValue}
                type="primary"
                theme="outline"
              >
                {t('添加模型区域')}
              </Button>
            </div>
          </div>
        </Form.Slot>
      </div>
    );
  };

  // 渲染可视化编辑器
  const renderVisualEditor = () => {
    switch (editorType) {
      case 'region':
        return renderRegionEditor();
      case 'object':
      case 'keyValue':
      default:
        return renderKeyValueEditor();
    }
  };

  const hasJsonError = jsonError && jsonError.trim() !== '';

  return (
    <Form.Slot label={label}>
      <Card
        header={
          <div className="flex justify-between items-center">
            <Tabs
              type="slash"
              activeKey={editMode}
              onChange={(key) => {
                if (key === 'manual' && editMode === 'visual') {
                  setEditMode('manual');
                } else if (key === 'visual' && editMode === 'manual') {
                  toggleEditMode();
                }
              }}
            >
              <TabPane tab={t('可视化')} itemKey="visual" />
              <TabPane tab={t('手动编辑')} itemKey="manual" />
            </Tabs>

            {template && templateLabel && (
              <Button
                type="tertiary"
                onClick={fillTemplate}
                size="small"
              >
                {templateLabel}
              </Button>
            )}
          </div>
        }
        headerStyle={{ padding: '12px 16px' }}
        bodyStyle={{ padding: '16px' }}
        className="!rounded-2xl"
      >
        {/* JSON错误提示 */}
        {hasJsonError && (
          <Banner
            type="danger"
            description={`JSON 格式错误: ${jsonError}`}
            className="mb-3"
          />
        )}

        {/* 编辑器内容 */}
        {editMode === 'visual' ? (
          <div>
            {renderVisualEditor()}
            {/* 隐藏的Form字段用于验证和数据绑定 */}
            <Form.Input
              field={field}
              value={value}
              rules={rules}
              style={{ display: 'none' }}
              noLabel={true}
              {...props}
            />
          </div>
        ) : (
          <div>
            <TextArea
              placeholder={placeholder}
              value={manualText}
              onChange={handleManualChange}
              showClear={showClear}
              rows={Math.max(8, manualText ? manualText.split('\n').length : 8)}
            />
            {/* 隐藏的Form字段用于验证和数据绑定 */}
            <Form.Input
              field={field}
              value={value}
              rules={rules}
              style={{ display: 'none' }}
              noLabel={true}
              {...props}
            />
          </div>
        )}

        {/* 额外文本显示在卡片底部 */}
        {extraText && (
          <Divider margin='12px' align='center'>
            <Text type="tertiary" size="small">{extraText}</Text>
          </Divider>
        )}
        {extraFooter && (
          <div className="mt-1">
            {extraFooter}
          </div>
        )}
      </Card>
    </Form.Slot>
  );
};

export default JSONEditor; 