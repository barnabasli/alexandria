import { useState, useEffect } from 'react';
import { Camera, Upload, User, Save } from 'lucide-react';
import { profileAPI } from '../api';

const ProfileManager = ({ user, authToken, onProfileUpdate }) => {
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    profileImageUrl: user?.profile_image_url || null
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('Please select a valid image file (JPG, PNG, or GIF)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setMessage('');

    try {
      const result = await profileAPI.uploadImage(file, authToken);
      setProfileData(prev => ({
        ...prev,
        profileImageUrl: result.profile_image_url
      }));
      setMessage('Profile image uploaded successfully!');
      
      // Update parent component
      if (onProfileUpdate) {
        onProfileUpdate({ ...profileData, profileImageUrl: result.profile_image_url });
      }
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage('');

    try {
      const updateData = {};
      if (profileData.name !== user?.name) {
        updateData.name = profileData.name;
      }
      if (profileData.bio !== user?.bio) {
        updateData.bio = profileData.bio;
      }

      const result = await profileAPI.updateProfile(updateData, authToken);
      setMessage('Profile updated successfully!');
      
      // Update parent component
      if (onProfileUpdate) {
        onProfileUpdate(result.user);
      }
    } catch (error) {
      setMessage(`Update failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name, email) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email ? email[0].toUpperCase() : 'U';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="dark-card p-8">
        <h2 className="text-2xl font-semibold mb-6 text-github-text">Manage Profile</h2>
        
        {/* Profile Image Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4 text-github-text">Profile Picture</h3>
          <div className="flex items-center space-x-6">
            <div className="relative">
              {profileData.profileImageUrl ? (
                <img
                  src={profileData.profileImageUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-github-border"
                />
              ) : (
                <div className="w-24 h-24 bg-github-accent rounded-full flex items-center justify-center border-2 border-github-border">
                  <span className="text-2xl font-medium text-github-bg">
                    {getInitials(profileData.name, user?.email)}
                  </span>
                </div>
              )}
              
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-github-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-github-accent-hover transition-colors">
                <Camera size={16} className="text-github-bg" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>
            
            <div className="flex-1">
              <p className="text-sm text-github-text-secondary mb-2">
                Upload a profile picture to personalize your account
              </p>
              <p className="text-xs text-github-text-muted">
                Supported formats: JPG, PNG, GIF (max 5MB)
              </p>
              {isUploading && (
                <p className="text-sm text-github-accent mt-2">Uploading...</p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Information Section */}
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-github-text-secondary mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              value={profileData.name}
              onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
              className="github-input w-full px-3 py-2"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-github-text-secondary mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              value={profileData.bio}
              onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
              className="github-input w-full px-3 py-2 h-24 resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-github-text-secondary mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="github-input w-full px-3 py-2 bg-github-bg-tertiary cursor-not-allowed"
            />
            <p className="text-xs text-github-text-muted mt-1">
              Email address cannot be changed
            </p>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${
            message.includes('successfully') 
              ? 'bg-green-900/20 border border-green-500/30 text-green-300'
              : 'bg-red-900/20 border border-red-500/30 text-red-300'
          }`}>
            {message}
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8">
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="github-button px-6 py-2 flex items-center space-x-2 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileManager; 