import React, { useCallback, useState } from 'react';
import { Layout } from '@douyinfe/semi-ui';
import ModelPricing from '../../components/ModelPricing';
import './PricesStyles.css';

const { Content } = Layout;

const Prices = () => {
  const [modelPricingApi, setModelPricingApi] = useState(null);
  
  // 处理 ModelPricing 组件初始化
  const handleModelPricingInit = useCallback((api) => {
    setModelPricingApi(api);
  }, []);

  return (
    <Layout>
      <Content style={{ padding: '24px' }}>
        <div className="prices-container">
          <div className="prices-header">
            <h1 className="prices-title">模型价格</h1>
            <p className="prices-subtitle">查看所有模型的详细价格信息</p>
          </div>
          
          <div className="prices-content">
            <ModelPricing onInitialize={handleModelPricingInit} />
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default Prices;