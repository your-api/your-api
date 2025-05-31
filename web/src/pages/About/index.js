import React, { useEffect, useState } from 'react';
import { API, showError } from '../../helpers';
import { Layout, Card, Row, Col, Space, Typography, Divider } from '@douyinfe/semi-ui';
import { IconPhone, IconMail, IconHome, IconUser, IconClock, IconComment } from '@douyinfe/semi-icons';
import { marked } from 'marked';
import { useTheme } from '../../context/Theme';
import './AboutStyles.css';

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
  const theme = useTheme();
  const isDarkMode = theme === 'dark';

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
      <div className="about-iframe-container">
        {about.startsWith('https://') ? (
          <iframe
            src={about}
            className="about-iframe"
          />
        ) : (
          <div
            className="about-content"
            dangerouslySetInnerHTML={{ __html: about.startsWith('<') ? about : marked.parse(about) }}
          />
        )}
      </div>
    );
  }

  const ContactCard = ({ icon, title, content, color = 'var(--semi-color-primary)' }) => {
    if (!content) return null;
    
    return (
      <Card 
        className="contact-card"
        bodyStyle={{ padding: 0, height: '100%' }}
      >
        <div className="contact-card-content">
          <div 
            className="contact-icon"
            style={{ 
              backgroundColor: `${color}15`,
              borderColor: `${color}30`,
              color: color
            }}
          >
            {icon}
          </div>
          <div className="contact-info">
            <Title heading={6} className="contact-title">
              {title}
            </Title>
            <Text className="contact-text">
              {content}
            </Text>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <Layout className="contact-layout">
        <Layout.Content className="contact-content loading-content">
          <div className="loading-spinner"></div>
          <Text>加载中...</Text>
        </Layout.Content>
      </Layout>
    );
  }

  // 准备联系方式数据，按新顺序排列：微信、QQ群、邮箱地址
  const contactItems = [
    { icon: <IconUser />, title: "微信", content: contactInfo.ContactWeChat || contactInfo.ContactPhone, color: "#07c160" },
    { icon: <IconComment />, title: "QQ群", content: contactInfo.ContactQQ, color: "var(--semi-color-info)" },
    { icon: <IconMail />, title: "邮箱地址", content: contactInfo.ContactEmail, color: "var(--semi-color-primary)" }
  ].filter(item => item.content); // 只显示有内容的项目

  return (
    <Layout className="contact-layout">
      <Layout.Content className="contact-content">
        <div className="contact-container">
          {/* 头部区域 */}
          <div className="contact-header">
            <div className="header-content">
              <Title heading={1} className="header-title">
                联系我们
              </Title>
              <Paragraph className="header-description">
                {contactInfo.ContactDescription}
              </Paragraph>
            </div>
          </div>

          {/* 联系方式卡片网格 */}
          <div className="contact-grid">
            <Row gutter={[16, 0]} justify="center">
              <Col xs={24} sm={8} md={8}>
                <ContactCard
                  icon={<IconUser />}
                  title="微信"
                  content={contactInfo.ContactWeChat || contactInfo.ContactPhone}
                  color="#07c160"
                />
              </Col>
              <Col xs={24} sm={8} md={8}>
                <ContactCard
                  icon={<IconComment />}
                  title="QQ群"
                  content={contactInfo.ContactQQ}
                  color="var(--semi-color-info)"
                />
              </Col>
              <Col xs={24} sm={8} md={8}>
                <ContactCard
                  icon={<IconMail />}
                  title="邮箱地址"
                  content={contactInfo.ContactEmail}
                  color="var(--semi-color-primary)"
                />
              </Col>
            </Row>
          </div>

          {/* 工作时间卡片 */}
          {contactInfo.ContactWorkTime && (
            <Card className="work-time-card" bodyStyle={{ padding: 0 }}>
              <div className="work-time-content">
                <div className="work-time-icon">
                  <IconClock />
                </div>
                <div className="work-time-info">
                  <Title heading={4} className="work-time-title">
                    服务时间
                  </Title>
                  <Text className="work-time-text">
                    {contactInfo.ContactWorkTime}
                  </Text>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default Contact;
