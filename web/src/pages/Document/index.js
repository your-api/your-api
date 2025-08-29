import React, { useContext, useState, useEffect } from 'react';
import { API, showError } from '../../helpers';
import { marked } from 'marked';
import { Layout } from '@douyinfe/semi-ui';
import { StatusContext } from "../../context/Status/index.jsx";

const Document = () => {
    const [statusState, statusDispatch] = useContext(StatusContext);
    const [isLoading, setIsLoading] = useState(true);
    const docsLink = statusState?.status?.docs_link || '';

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    return (
        <Layout style={{ paddingTop: '64px', padding: '84px 20px 20px 20px', height: '100vh' }}>
            {docsLink ? (
                <div className="relative w-full h-full">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-md">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                        </div>
                    )}
                    <iframe
                        src={docsLink}
                        title="Documentation"
                        width="100%"
                        height="100%"
                        className={`rounded-md shadow-md ${isLoading ? 'invisible' : 'visible'}`}
                        style={{ border: 'none' }}
                        allowFullScreen
                        onLoad={handleIframeLoad}
                    />
                </div>
            ) : (
                <div className="p-4 text-center text-gray-600">No documentation link available</div>
            )}
        </Layout>
    );
};

export default Document;