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

import React from 'react';
import { Card, Avatar, Skeleton, Tag } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const StatsCards = ({
  groupedStatsData,
  loading
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {groupedStatsData.map((group, idx) => (
          <Card
            key={idx}
            className={`${group.color} border-0 !rounded-2xl w-full`}
            title={group.title}
          >
            <div className="space-y-4">
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={item.onClick}
                >
                  <div className="flex items-center">
                    <Avatar
                      className="mr-3"
                      size="small"
                      color={item.avatarColor}
                    >
                      {item.icon}
                    </Avatar>
                    <div>
                      <div className="text-xs text-gray-500">{item.title}</div>
                      <div className="text-lg font-semibold">
                        <Skeleton
                          loading={loading}
                          active
                          placeholder={
                            <Skeleton.Paragraph
                              active
                              rows={1}
                              style={{ width: '65px', height: '24px', marginTop: '4px' }}
                            />
                          }
                        >
                          {item.value}
                        </Skeleton>
                      </div>
                    </div>
                  </div>
                  {item.title === t('当前余额') ? (
                    <Tag
                      color="white"
                      shape='circle'
                      size="large"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/console/topup');
                      }}
                    >
                      {t('充值')}
                    </Tag>
                  ) : (loading || (item.trendData && item.trendData.length > 0)) && (
                    <div className="w-24 h-10">
                      <VChart
                        spec={getTrendSpec(item.trendData, item.trendColor)}
                        option={CHART_CONFIG}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Chart configuration for mini trend charts
const CHART_CONFIG = {
  animation: false,
  padding: { top: 2, right: 2, bottom: 2, left: 2 },
};

// Generate mini trend chart specification
const getTrendSpec = (data, color) => {
  if (!data || data.length === 0) {
    return {
      type: 'line',
      data: {
        values: []
      },
      width: 96,
      height: 40,
    };
  }
  
  return {
    type: 'line',
    data: {
      values: data.map((value, index) => ({
        x: index,
        y: value || 0,
      }))
    },
    width: 96,
    height: 40,
    xField: 'x',
    yField: 'y',
    line: {
      style: {
        stroke: color || '#6366f1',
        lineWidth: 2,
      }
    },
    point: false,
    axes: false,
    legends: false,
    tooltip: false,
    crosshair: false,
  };
};

export default StatsCards; 