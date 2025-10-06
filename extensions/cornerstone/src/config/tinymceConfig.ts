// TinyMCE configuration for self-hosted instance
export const TINYMCE_CONFIG = {
  // Self-hosted TinyMCE base URL - CORRECTED
  baseUrl: '/tinymce',

  // Common configuration for all TinyMCE instances
  commonConfig: {
    height: 500,
    menubar: false,
    plugins: [
      'advlist',
      'autolink',
      'lists',
      'link',
      'image',
      'charmap',
      'preview',
      'anchor',
      'searchreplace',
      'visualblocks',
      'code',
      'fullscreen',
      'insertdatetime',
      'media',
      'table',
      'code',
      'help',
      'wordcount',
    ],
    toolbar:
      'undo redo | blocks | ' +
      'bold italic forecolor | alignleft aligncenter ' +
      'alignright alignjustify | bullist numlist outdent indent | ' +
      'removeformat | help',
    content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
    branding: false,
    elementpath: false,
    resize: false,
    statusbar: false,
  },

  // Dark theme configuration for ReportGenerationModal
  darkThemeConfig: {
    height: '100%',
    min_height: 600,
    skin: 'oxide-dark',
    content_css: 'dark',
    content_style: `
      body {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        background-color: #1a1a1a !important;
        color: #ffffff !important;
        margin: 0;
        padding: 16px;
      }
      p { margin: 0 0 16px 0; color: #ffffff !important; }
      h1, h2, h3, h4, h5, h6 { color: #ffffff !important; }
      ul, ol { color: #ffffff !important; }
      li { color: #ffffff !important; }
      blockquote {
        border-left: 4px solid #3b82f6;
        margin: 16px 0;
        padding-left: 16px;
        color: #d1d5db !important;
      }
      .mce-content-body {
        background-color: #1a1a1a !important;
        color: #ffffff !important;
      }
      .tox-edit-area {
        background-color: #1a1a1a !important;
      }
      .tox-edit-area__iframe {
        background-color: #1a1a1a !important;
      }
    `,
    toolbar_mode: 'wrap',
    toolbar_sticky: true,
    toolbar_sticky_offset: 0,
  },
};

// Helper function to get TinyMCE configuration
export const getTinyMCEConfig = (useDarkTheme = false) => {
  const baseConfig = {
    ...TINYMCE_CONFIG.commonConfig,
    base_url: TINYMCE_CONFIG.baseUrl,
    suffix: '.min',
    // Force self-hosted mode - use GPL license for self-hosted
    license_key: 'gpl',
    // Disable cloud features
    cloud_channel: false,
    // Explicitly set paths to local files
    skin_url: `${TINYMCE_CONFIG.baseUrl}/skins/ui/oxide`,
    content_css: `${TINYMCE_CONFIG.baseUrl}/skins/content/default/content.min.css`,
  };

  if (useDarkTheme) {
    return {
      ...baseConfig,
      ...TINYMCE_CONFIG.darkThemeConfig,
    };
  }

  return baseConfig;
};
