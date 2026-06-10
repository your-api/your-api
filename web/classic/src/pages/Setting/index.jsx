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

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Layout, TabPane, Tabs } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Calculator,
  Gauge,
  Shapes,
  Cog,
  MoreHorizontal,
  LayoutDashboard,
  MessageSquare,
  Palette,
  CreditCard,
  Server,
  Activity,
} from 'lucide-react';

import { isRoot } from '../../helpers';

const SystemSetting = lazy(() => import('../../components/settings/SystemSetting'));
const OtherSetting = lazy(() => import('../../components/settings/OtherSetting'));
const OperationSetting = lazy(
  () => import('../../components/settings/OperationSetting'),
);
const RateLimitSetting = lazy(
  () => import('../../components/settings/RateLimitSetting'),
);
const ModelSetting = lazy(() => import('../../components/settings/ModelSetting'));
const DashboardSetting = lazy(
  () => import('../../components/settings/DashboardSetting'),
);
const RatioSetting = lazy(() => import('../../components/settings/RatioSetting'));
const ChatsSetting = lazy(() => import('../../components/settings/ChatsSetting'));
const DrawingSetting = lazy(
  () => import('../../components/settings/DrawingSetting'),
);
const PaymentSetting = lazy(
  () => import('../../components/settings/PaymentSetting'),
);
const ModelDeploymentSetting = lazy(
  () => import('../../components/settings/ModelDeploymentSetting'),
);
const PerformanceSetting = lazy(
  () => import('../../components/settings/PerformanceSetting'),
);

const Setting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabActiveKey, setTabActiveKey] = useState('1');
  let panes = [];

  if (isRoot()) {
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Settings size={18} />
          {t('运营设置')}
        </span>
      ),
      component: OperationSetting,
      itemKey: 'operation',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <LayoutDashboard size={18} />
          {t('仪表盘设置')}
        </span>
      ),
      component: DashboardSetting,
      itemKey: 'dashboard',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MessageSquare size={18} />
          {t('聊天设置')}
        </span>
      ),
      component: ChatsSetting,
      itemKey: 'chats',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Palette size={18} />
          {t('绘图设置')}
        </span>
      ),
      component: DrawingSetting,
      itemKey: 'drawing',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <CreditCard size={18} />
          {t('支付设置')}
        </span>
      ),
      component: PaymentSetting,
      itemKey: 'payment',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calculator size={18} />
          {t('分组与模型定价设置')}
        </span>
      ),
      component: RatioSetting,
      itemKey: 'ratio',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Gauge size={18} />
          {t('速率限制设置')}
        </span>
      ),
      component: RateLimitSetting,
      itemKey: 'ratelimit',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Shapes size={18} />
          {t('模型相关设置')}
        </span>
      ),
      component: ModelSetting,
      itemKey: 'models',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Server size={18} />
          {t('模型部署设置')}
        </span>
      ),
      component: ModelDeploymentSetting,
      itemKey: 'model-deployment',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Activity size={18} />
          {t('性能设置')}
        </span>
      ),
      component: PerformanceSetting,
      itemKey: 'performance',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Cog size={18} />
          {t('系统设置')}
        </span>
      ),
      component: SystemSetting,
      itemKey: 'system',
    });
    panes.push({
      tab: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MoreHorizontal size={18} />
          {t('其他设置')}
        </span>
      ),
      component: OtherSetting,
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
    <div className='mt-[60px] px-2'>
      <Layout>
        <Layout.Content>
          <Tabs
            type='card'
            collapsible
            activeKey={tabActiveKey}
            onChange={(key) => onChangeTab(key)}
          >
            {panes.map((pane) => (
              <TabPane itemKey={pane.itemKey} tab={pane.tab} key={pane.itemKey}>
                {tabActiveKey === pane.itemKey && (
                  <Suspense fallback={null}>
                    <pane.component />
                  </Suspense>
                )}
              </TabPane>
            ))}
          </Tabs>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default Setting;
