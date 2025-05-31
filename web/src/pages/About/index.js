import React, { useEffect, useState } from 'react';
import { API, showError } from '../../helpers';
import { Layout, Card, Row, Col, Space, Typography, Divider, Avatar } from '@douyinfe/semi-ui';
import { IconPhone, IconMail, IconHome, IconUser, IconClock, IconComment } from '@douyinfe/semi-icons';
import { marked } from 'marked';

const { Title, Text, Paragraph } = Typography;

const Contact = () => {
  const [contactInfo, setContactInfo] = useState({
    ContactPhone: '',
    ContactEmail: '',
    ContactAddress: '',
    ContactWeChat: '',
    ContactQQ: '',
    ContactTelegram: '',
    ContactWorkTime: '周一至周五 9:00-18:00',
    ContactDescription: '如有任何问题或建议，请随时联系我们的客服团队。我们将竭诚为您服务！'
  });
  const [about, setAbout] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchContactInfo = async () => {
    try {
      // 首先获取About配置
      const aboutRes = await API.get('/api/about');
      if (aboutRes.data.success && aboutRes.data.data) {
        setAbout(aboutRes.data.data);
        setLoading(false);
        return; // 如果有About配置，直接返回
      }

      // 如果没有About配置，获取联系方式配置
      const contactRes = await API.get('/api/contact');
      if (contactRes.data.success) {
        const contactData = contactRes.data.data;
        // 合并默认值和从服务器获取的数据
        const newContactInfo = {
          ContactPhone: contactData.ContactPhone || '',
          ContactEmail: contactData.ContactEmail || '',
          ContactAddress: contactData.ContactAddress || '',
          ContactWeChat: contactData.ContactWeChat || '',
          ContactQQ: contactData.ContactQQ || '',
          ContactTelegram: contactData.ContactTelegram || '',
          ContactWorkTime: contactData.ContactWorkTime || '周一至周五 9:00-18:00',
          ContactDescription: contactData.ContactDescription || '如有任何问题或建议，请随时联系我们的客服团队。我们将竭诚为您服务！'
        };
        setContactInfo(newContactInfo);
      } else {
        showError('获取联系方式失败');
      }
    } catch (error) {
      showError('获取联系信息失败');
      console.error('Error fetching contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactInfo();
  }, []);

  // 如果有About配置，显示About内容
  if (about) {
    return (
      <>
        {about.startsWith('https://') ? (
          <iframe
            src={about}
            style={{ width: '100%', height: '100vh', border: 'none' }}
          />
        ) : (
          <div
            style={{ fontSize: 'larger', padding: '40px' }}
            dangerouslySetInnerHTML={{ __html: about.startsWith('<') ? about : marked.parse(about) }}
          ></div>
        )}
      </>
    );
  }

  const ContactCard = ({ icon, title, content, color = '#6366f1' }) => {
    if (!content) return null;
    
    return (
      <Card 
        style={{ 
          height: '100%',
          border: '1px solid #f0f0f0',
          borderRadius: '12px',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
        bodyStyle={{ padding: '24px' }}
        hoverable
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        }}
      >
        <Space direction="vertical" spacing="medium" style={{ width: '100%' }}>
          <Avatar 
            style={{ 
              backgroundColor: color + '20',
              color: color,
              border: `2px solid ${color}30`
            }}
            size="large"
          >
            {icon}
          </Avatar>
          <div>
            <Title heading={6} style={{ margin: 0, color: '#1a1a1a' }}>
              {title}
            </Title>
            <Text style={{ color: '#666', lineHeight: '1.6', marginTop: '8px', display: 'block' }}>
              {content}
            </Text>
          </div>
        </Space>
      </Card>
    );
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#fafafa' }}>
        <Layout.Content style={{ padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Text>加载中...</Text>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Layout.Content style={{ padding: '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* 头部区域 */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '60px',
            padding: '40px 20px',
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            <Title 
              heading={1} 
              style={{ 
                color: '#1a1a1a', 
                marginBottom: '16px',
                fontSize: '3rem',
                fontWeight: '700'
              }}
            >
              联系我们
            </Title>
            <Paragraph 
              style={{ 
                fontSize: '18px', 
                color: '#666',
                maxWidth: '600px',
                margin: '0 auto',
                lineHeight: '1.8'
              }}
            >
              {contactInfo.ContactDescription}
            </Paragraph>
          </div>

          {/* 联系方式卡片 */}
          <Row gutter={[24, 24]} style={{ marginBottom: '40px' }}>
            <Col xs={24} sm={12} md={8}>
              <ContactCard
                icon={<IconPhone />}
                title="联系电话"
                content={contactInfo.ContactPhone}
                color="#10b981"
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <ContactCard
                icon={<IconMail />}
                title="邮箱地址"
                content={contactInfo.ContactEmail}
                color="#3b82f6"
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <ContactCard
                icon={<IconHome />}
                title="联系地址"
                content={contactInfo.ContactAddress}
                color="#8b5cf6"
              />
            </Col>
          </Row>

          {/* 社交媒体联系方式 */}
          <Row gutter={[24, 24]} style={{ marginBottom: '40px' }}>
            <Col xs={24} sm={12} md={8}>
              <ContactCard
                icon={<IconUser />}
                title="微信号"
                content={contactInfo.ContactWeChat}
                color="#07c160"
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <ContactCard
                icon={<IconComment />}
                title="QQ号"
                content={contactInfo.ContactQQ}
                color="#1677ff"
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <ContactCard
                icon={<IconUser />}
                title="Telegram"
                content={contactInfo.ContactTelegram}
                color="#0088cc"
              />
            </Col>
          </Row>

          {/* 工作时间 */}
          {contactInfo.ContactWorkTime && (
            <Card 
              style={{ 
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '16px',
                border: 'none',
                backdropFilter: 'blur(10px)'
              }}
              bodyStyle={{ padding: '32px' }}
            >
              <div style={{ textAlign: 'center' }}>
                <Avatar 
                  style={{ 
                    backgroundColor: '#f59e0b20',
                    color: '#f59e0b',
                    border: '2px solid #f59e0b30',
                    marginBottom: '16px'
                  }}
                  size="large"
                >
                  <IconClock />
                </Avatar>
                <Title heading={4} style={{ margin: '0 0 8px 0', color: '#1a1a1a' }}>
                  服务时间
                </Title>
                <Text style={{ fontSize: '16px', color: '#666' }}>
                  {contactInfo.ContactWorkTime}
                </Text>
              </div>
            </Card>
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default Contact;
