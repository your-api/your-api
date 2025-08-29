/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useRef, useEffect } from 'react';
import {
  Button,
  Typography,
  Card,
  Avatar,
  Form,
  Radio,
  Toast,
  Tabs,
  TabPane
} from '@douyinfe/semi-ui';
import {
  IconMail,
  IconKey,
  IconBell,
  IconLink
} from '@douyinfe/semi-icons';
import { ShieldCheck, Bell, DollarSign } from 'lucide-react';
import { renderQuotaWithPrompt } from '../../../../helpers';
import CodeViewer from '../../../playground/CodeViewer';

const NotificationSettings = ({
  t,
  notificationSettings,
  handleNotificationSettingChange,
  saveNotificationSettings
}) => {
  const formApiRef = useRef(null);

  // 初始化表单值
  useEffect(() => {
    if (formApiRef.current && notificationSettings) {
      formApiRef.current.setValues(notificationSettings);
    }
  }, [notificationSettings]);

  // 处理表单字段变化
  const handleFormChange = (field, value) => {
    handleNotificationSettingChange(field, value);
  };

  // 表单提交
  const handleSubmit = () => {
    if (formApiRef.current) {
      formApiRef.current.validate()
        .then(() => {
          saveNotificationSettings();
        })
        .catch((errors) => {
          console.log('表单验证失败:', errors);
          Toast.error(t('请检查表单填写是否正确'));
        });
    } else {
      saveNotificationSettings();
    }
  };

  return (
    <Card
      className="!rounded-2xl shadow-sm border-0"
      footer={
        <div className="flex justify-end">
          <Button
            type='primary'
            onClick={handleSubmit}
          >
            {t('保存设置')}
          </Button>
        </div>
      }
    >
      {/* 卡片头部 */}
      <div className="flex items-center mb-4">
        <Avatar size="small" color="blue" className="mr-3 shadow-md">
          <Bell size={16} />
        </Avatar>
        <div>
          <Typography.Text className="text-lg font-medium">{t('其他设置')}</Typography.Text>
          <div className="text-xs text-gray-600">{t('通知、价格和隐私相关设置')}</div>
        </div>
      </div>

      <Form
        getFormApi={(api) => (formApiRef.current = api)}
        initValues={notificationSettings}
        onSubmit={handleSubmit}
      >
        {() => (
          <Tabs type="card" defaultActiveKey="notification">
            {/* 通知配置 Tab */}
            <TabPane
              tab={
                <div className="flex items-center">
                  <Bell size={16} className="mr-2" />
                  {t('通知配置')}
                </div>
              }
              itemKey="notification"
            >
              <div className="py-4">
                <Form.RadioGroup
                  field='warningType'
                  label={t('通知方式')}
                  initValue={notificationSettings.warningType}
                  onChange={(value) => handleFormChange('warningType', value)}
                  rules={[{ required: true, message: t('请选择通知方式') }]}
                >
                  <Radio value="email">{t('邮件通知')}</Radio>
                  <Radio value="webhook">{t('Webhook通知')}</Radio>
                </Form.RadioGroup>

                <Form.AutoComplete
                  field='warningThreshold'
                  label={
                    <span>
                      {t('额度预警阈值')} {renderQuotaWithPrompt(notificationSettings.warningThreshold)}
                    </span>
                  }
                  placeholder={t('请输入预警额度')}
                  data={[
                    { value: 100000, label: '0.2$' },
                    { value: 500000, label: '1$' },
                    { value: 1000000, label: '5$' },
                    { value: 5000000, label: '10$' },
                  ]}
                  onChange={(val) => handleFormChange('warningThreshold', val)}
                  prefix={<IconBell />}
                  extraText={t('当剩余额度低于此数值时，系统将通过选择的方式发送通知')}
                  style={{ width: '100%', maxWidth: '300px' }}
                  rules={[
                    { required: true, message: t('请输入预警阈值') },
                    {
                      validator: (rule, value) => {
                        const numValue = Number(value);
                        if (isNaN(numValue) || numValue <= 0) {
                          return Promise.reject(t('预警阈值必须为正数'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                />

                {/* 邮件通知设置 */}
                {notificationSettings.warningType === 'email' && (
                  <Form.Input
                    field='notificationEmail'
                    label={t('通知邮箱')}
                    placeholder={t('留空则使用账号绑定的邮箱')}
                    onChange={(val) => handleFormChange('notificationEmail', val)}
                    prefix={<IconMail />}
                    extraText={t('设置用于接收额度预警的邮箱地址，不填则使用账号绑定的邮箱')}
                    showClear
                  />
                )}

                {/* Webhook通知设置 */}
                {notificationSettings.warningType === 'webhook' && (
                  <>
                    <Form.Input
                      field='webhookUrl'
                      label={t('Webhook地址')}
                      placeholder={t('请输入Webhook地址，例如: https://example.com/webhook')}
                      onChange={(val) => handleFormChange('webhookUrl', val)}
                      prefix={<IconLink />}
                      extraText={t('只支持HTTPS，系统将以POST方式发送通知，请确保地址可以接收POST请求')}
                      showClear
                      rules={[
                        {
                          required: notificationSettings.warningType === 'webhook',
                          message: t('请输入Webhook地址')
                        },
                        {
                          pattern: /^https:\/\/.+/,
                          message: t('Webhook地址必须以https://开头')
                        }
                      ]}
                    />

                    <Form.Input
                      field='webhookSecret'
                      label={t('接口凭证')}
                      placeholder={t('请输入密钥')}
                      onChange={(val) => handleFormChange('webhookSecret', val)}
                      prefix={<IconKey />}
                      extraText={t('密钥将以Bearer方式添加到请求头中，用于验证webhook请求的合法性')}
                      showClear
                    />

                    <Form.Slot label={t('Webhook请求结构说明')}>
                      <div>
                        <div style={{ height: '200px', marginBottom: '12px' }}>
                          <CodeViewer
                            content={{
                              "type": "quota_exceed",
                              "title": "额度预警通知",
                              "content": "您的额度即将用尽，当前剩余额度为 {{value}}",
                              "values": ["$0.99"],
                              "timestamp": 1739950503
                            }}
                            title="webhook"
                            language="json"
                          />
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                          <div><strong>type:</strong> {t('通知类型 (quota_exceed: 额度预警)')} </div>
                          <div><strong>title:</strong> {t('通知标题')}</div>
                          <div><strong>content:</strong> {t('通知内容，支持 {{value}} 变量占位符')}</div>
                          <div><strong>values:</strong> {t('按顺序替换content中的变量占位符')}</div>
                          <div><strong>timestamp:</strong> {t('Unix时间戳')}</div>
                        </div>
                      </div>
                    </Form.Slot>
                  </>
                )}
              </div>
            </TabPane>

            {/* 价格设置 Tab */}
            <TabPane
              tab={
                <div className="flex items-center">
                  <DollarSign size={16} className="mr-2" />
                  {t('价格设置')}
                </div>
              }
              itemKey="pricing"
            >
              <div className="py-4">
                <Form.Switch
                  field='acceptUnsetModelRatioModel'
                  label={t('接受未设置价格模型')}
                  checkedText={t('开')}
                  uncheckedText={t('关')}
                  onChange={(value) => handleFormChange('acceptUnsetModelRatioModel', value)}
                  extraText={t('当模型没有设置价格时仍接受调用，仅当您信任该网站时使用，可能会产生高额费用')}
                />
              </div>
            </TabPane>

            {/* 隐私设置 Tab */}
            <TabPane
              tab={
                <div className="flex items-center">
                  <ShieldCheck size={16} className="mr-2" />
                  {t('隐私设置')}
                </div>
              }
              itemKey="privacy"
            >
              <div className="py-4">
                <Form.Switch
                  field='recordIpLog'
                  label={t('记录请求与错误日志IP')}
                  checkedText={t('开')}
                  uncheckedText={t('关')}
                  onChange={(value) => handleFormChange('recordIpLog', value)}
                  extraText={t('开启后，仅"消费"和"错误"日志将记录您的客户端IP地址')}
                />
              </div>
            </TabPane>
          </Tabs>
        )}
      </Form>
    </Card>
  );
};

export default NotificationSettings;
