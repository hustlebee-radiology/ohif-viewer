# Self-Hosted TinyMCE Integration

This document explains how the self-hosted TinyMCE editor is integrated into the OHIF viewer.

## Configuration

The TinyMCE configuration is centralized in `tinymceConfig.ts` and provides:

- **Base URL**: `http://localhost:5000/tinymce` (your self-hosted instance)
- **Common Configuration**: Shared settings for all TinyMCE instances
- **Dark Theme Support**: Special configuration for the ReportGenerationModal

## Usage

### ReportGenerationModal.tsx
Uses the dark theme configuration with:
```typescript
init={{
  ...getTinyMCEConfig(true), // true = use dark theme
  setup: editor => {
    // Custom setup logic
  }
}}
```

### PanelTemplate.tsx
Uses the standard configuration:
```typescript
init={getTinyMCEConfig(false)} // false = use standard theme
```

## Key Changes Made

1. **Removed hardcoded API key**: No longer uses `apiKey="b0ggc7dfi30js013j5ardxxnumm26dhq5duxeqb15qt369l5"`
2. **Added base_url configuration**: Points to your self-hosted instance
3. **Centralized configuration**: All TinyMCE settings are now in one place
4. **Maintained functionality**: All existing features (dark theme, plugins, toolbar) are preserved

## Requirements

- Your self-hosted TinyMCE instance must be running on `http://localhost:5000/tinymce`
- The instance should serve the TinyMCE JavaScript files and assets
- CORS should be configured to allow requests from your OHIF viewer domain

## Testing

To test the integration:

1. Ensure your self-hosted TinyMCE is running on `http://localhost:5000/tinymce`
2. Start the OHIF viewer
3. Open the Report Generation Modal or Panel Template
4. Verify that the TinyMCE editor loads from your self-hosted instance
5. Test all editor functionality (typing, formatting, etc.)

## Troubleshooting

If the editor doesn't load:

1. Check that your TinyMCE server is running on the correct port
2. Verify the base URL in `tinymceConfig.ts`
3. Check browser console for any CORS or network errors
4. Ensure your TinyMCE instance serves the required files

## Customization

To modify the TinyMCE configuration:

1. Edit `tinymceConfig.ts`
2. Update the `commonConfig` object for shared settings
3. Update the `darkThemeConfig` object for dark theme specific settings
4. Modify the `getTinyMCEConfig()` function if you need different configurations
