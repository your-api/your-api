import React from 'react';
import { Card, Typography, Row, Col } from '@douyinfe/semi-ui';
import { IconUser, IconComment, IconClock, IconSend } from '@douyinfe/semi-icons';
import './Contact.css';

const { Title, Paragraph, Text } = Typography;

const Contact = () => {
  return (
    <div className="contact-container"  style={{ paddingTop: '60px' }}>
      <div className="contact-header">
        <div className="header-content">
          <Title heading={1} className="header-title">
            联系我们
          </Title>
          <Paragraph className="header-description">
            如有任何问题或建议或合作交流，请随时联系我们的客服团队。我们将竭诚为您服务！
          </Paragraph>
        </div>
      </div>

      <div className="contact-grid">
        <Row gutter={16}>
          <Col xs={24} sm={8} md={8}>
            <Card className="contact-card" bodyStyle={{ padding: 0, height: '100%' }}>
              <div className="contact-card-content">
                <div 
                  className="contact-icon"
                  style={{ 
                    backgroundColor: 'rgba(7, 193, 96, 0.082)',
                    borderColor: 'rgba(7, 193, 96, 0.19)',
                    color: 'rgb(7, 193, 96)'
                  }}
                >
                  <IconUser size="inherit" />
                </div>
                <div className="contact-info">
                  <Title heading={6} className="contact-title">
                    微信
                  </Title>
                  <Text className="contact-text">
                    微信号：risers1
                  </Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={8} md={8}>
            <Card className="contact-card" bodyStyle={{ padding: 0, height: '100%' }}>
              <div className="contact-card-content">
                <div 
                  className="contact-icon"
                  style={{ 
                    backgroundColor: 'var(--semi-color-info-light-default)',
                    borderColor: 'var(--semi-color-info-light-hover)',
                    color: 'var(--semi-color-info)'
                  }}
                >
                  <IconComment size="inherit" />
                </div>
                <div className="contact-info">
                  <Title heading={6} className="contact-title">
                    QQ
                  </Title>
                  <Text className="contact-text">
                    请加QQ：2137994192
                  </Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={8} md={8}>
            <Card className="contact-card" bodyStyle={{ padding: 0, height: '100%' }}>
              <div className="contact-card-content">
                <div 
                  className="contact-icon"
                  style={{ 
                    backgroundColor: 'var(--semi-color-primary-light-default)',
                    borderColor: 'var(--semi-color-primary-light-hover)',
                    color: 'var(--semi-color-primary)'
                  }}
                >
                  <IconSend size="inherit" />
                </div>
                <div className="contact-info">
                  <Title heading={6} className="contact-title">
                    Telegram
                  </Title>
                  <Text className="contact-text">
                    联系TG：@youare
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <Card className="work-time-card" bodyStyle={{ padding: 0 }}>
        <div className="work-time-content">
          <div className="work-time-icon">
            <IconClock size="inherit" />
          </div>
          <div className="work-time-info">
            <Title heading={4} className="work-time-title">
              服务时间
            </Title>
            <Text className="work-time-text">
              周一至周六 8:00-22:00
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Contact;