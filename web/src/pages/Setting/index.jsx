import React, { useEffect, useState } from 'react';
import { Layout, TabPane, Tabs } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import SystemSetting from '../../components/settings/SystemSetting';
import { isRoot } from '../../helpers';
import OtherSetting from '../../components/settings/OtherSetting';
<<<<<<< HEAD:web/src/pages/Setting/index.js
import PersonalSetting from '../../components/settings/PersonalSetting';
import OperationSetting from '../../components/settings/OperationSetting';
import RateLimitSetting from '../../components/settings/RateLimitSetting.js';
import ModelSetting from '../../components/settings/ModelSetting.js';
import DashboardSetting from '../../components/settings/DashboardSetting.js';
import RatioSetting from '../../components/settings/RatioSetting.js';
import ChatsSetting from '../../components/settings/ChatsSetting.js';
import DrawingSetting from '../../components/settings/DrawingSetting.js';
import PaymentSetting from '../../components/settings/PaymentSetting.js';
=======
import OperationSetting from '../../components/settings/OperationSetting';
import RateLimitSetting from '../../components/settings/RateLimitSetting';
import ModelSetting from '../../components/settings/ModelSetting';
import DashboardSetting from '../../components/settings/DashboardSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import ChatsSetting from '../../components/settings/ChatsSetting';
import DrawingSetting from '../../components/settings/DrawingSetting';
import PaymentSetting from '../../components/settings/PaymentSetting';
>>>>>>> alpha:web/src/pages/Setting/index.jsx

const Setting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabActiveKey, setTabActiveKey] = useState('1');
  let panes = [];

  if (isRoot()) {
    panes.push({
      tab: t('运营设置'),
      content: <OperationSetting />,
      itemKey: 'operation',
    });
    panes.push({
      tab: t('仪表盘设置'),
      content: <DashboardSetting />,
      itemKey: 'dashboard',
    });
    panes.push({
      tab: t('聊天设置'),
      content: <ChatsSetting />,
      itemKey: 'chats',
    });
    panes.push({
      tab: t('绘图设置'),
      content: <DrawingSetting />,
      itemKey: 'drawing',
    });
    panes.push({
      tab: t('支付设置'),
      content: <PaymentSetting />,
      itemKey: 'payment',
    });
    panes.push({
      tab: t('倍率设置'),
      content: <RatioSetting />,
      itemKey: 'ratio',
    });
    panes.push({
      tab: t('速率限制设置'),
      content: <RateLimitSetting />,
      itemKey: 'ratelimit',
    });
    panes.push({
      tab: t('模型相关设置'),
      content: <ModelSetting />,
      itemKey: 'models',
    });
    panes.push({
      tab: t('系统设置'),
      content: <SystemSetting />,
      itemKey: 'system',
    });
    panes.push({
      tab: t('其他设置'),
      content: <OtherSetting />,
      itemKey: 'other',
    });
  }
  const onChangeTab = (key) => {
    setTabActiveKey(key);
    navigate(`?tab=${key}`);
  };
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab) {
      setTabActiveKey(tab);
    } else {
      onChangeTab('operation');
    }
  }, [location.search]);
  return (
    <div className="mt-[60px]">
      <Layout>
        <Layout.Content>
          <Tabs
            type='line'
            activeKey={tabActiveKey}
            onChange={(key) => onChangeTab(key)}
          >
            {panes.map((pane) => (
              <TabPane itemKey={pane.itemKey} tab={pane.tab} key={pane.itemKey}>
                {tabActiveKey === pane.itemKey && pane.content}
              </TabPane>
            ))}
          </Tabs>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default Setting;
