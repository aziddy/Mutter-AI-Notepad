# Transcription Naming Feature Implementation

## Overview
Added the ability to name and rename transcriptions in the Mutter AI Notepad application. This feature allows users to:
- Set custom names when creating new transcriptions
- Rename existing transcriptions through a modal dialog
- See custom names in the transcription list and results header

## Features Implemented

### 1. Custom Name Input During Transcription
- Added a text input field in the file info section
- Pre-fills with the original filename (without extension)
- Allows users to customize the name before starting transcription
- The custom name is saved in the transcription metadata

### 2. Rename Existing Transcriptions
- Added a rename button (edit icon) that appears on hover for each transcription
- Clicking the rename button opens a modal dialog
- Users can edit the current name and save changes
- Changes are persisted to the JSON metadata file

### 3. Visual Improvements
- Custom names are displayed in the transcription list instead of folder names
- Results header shows the custom name when a transcription is loaded
- Rename button has hover effects and proper styling
- Modal dialog with smooth animations and keyboard shortcuts

## Technical Implementation

### Backend Changes (main.js)
- Modified `transcribe-file` handler to accept a `customName` parameter
- Added `update-transcription-name` handler for renaming existing transcriptions
- Updated JSON metadata structure to include `customName` field
- Enhanced `get-transcriptions` to include custom names in the response

### Frontend Changes (renderer.js)
- Added `showRenameDialog()` function for modal dialog management
- Updated `displayTranscriptions()` to show custom names and rename buttons
- Modified `showTranscriptionResults()` and `loadTranscription()` to display custom names in headers
- Enhanced `showFileInfo()` to pre-fill the name input with the original filename

### UI Changes (index.html & styles.css)
- Added transcription name input field in file info section
- Added rename button styling with hover effects
- Implemented modal dialog with proper styling and animations
- Added responsive design considerations

### IPC Bridge (preload.js)
- Added `updateTranscriptionName` API for renaming functionality
- Updated `transcribeFile` to accept custom name parameter

## User Experience

### Creating New Transcriptions
1. Select an audio/video file
2. The name input is pre-filled with the original filename
3. Optionally edit the name before starting transcription
4. The custom name is saved with the transcription

### Renaming Existing Transcriptions
1. Hover over a transcription in the list
2. Click the edit icon (rename button)
3. Edit the name in the modal dialog
4. Press Enter or click Save to apply changes
5. Press Escape or click Cancel to close without saving

### Visual Feedback
- Custom names are prominently displayed in the transcription list
- Results header shows the custom name when viewing a transcription
- Toast notifications confirm successful rename operations
- Error messages for failed operations

## Data Structure
The custom name is stored in the transcription's JSON metadata:
```json
{
  "metadata": {
    "customName": "User-defined name",
    "originalFile": "/path/to/original/file.mp4",
    // ... other metadata
  }
}
```

## Migration
- Existing transcriptions without custom names are automatically updated with default names based on their original filenames
- The system gracefully handles transcriptions with or without custom names
- Backward compatibility is maintained

## Future Enhancements
- Bulk rename functionality
- Search/filter by custom names
- Name validation (prevent duplicates, invalid characters)
- Export/import custom names
- Name templates with variables (date, time, etc.) 