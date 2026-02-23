import React, { useState, useEffect } from 'react';
import { PermissionMode } from '../../shared/types';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldOff,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';

interface PermissionSelectorProps {
  currentMode: PermissionMode;
  onModeChange: (mode: PermissionMode) => void;
  allowBypass: boolean;
  disabled?: boolean;
  showDescriptions?: boolean;
}

const permissionModes = [
  {
    mode: PermissionMode.ASK,
    label: 'Ask permissions',
    description: 'Ask before editing files or running commands',
    icon: Shield,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  {
    mode: PermissionMode.AUTO_ACCEPT_EDITS,
    label: 'Auto accept edits',
    description: 'Auto-accept file edits, ask for commands',
    icon: ShieldCheck,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
  {
    mode: PermissionMode.PLAN,
    label: 'Plan mode',
    description: 'Analyze only, no changes or commands',
    icon: ShieldAlert,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30'
  },
  {
    mode: PermissionMode.BYPASS,
    label: 'Bypass permissions',
    description: 'Run without any permission prompts',
    icon: ShieldOff,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    dangerous: true
  }
];

export const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  currentMode,
  onModeChange,
  allowBypass,
  disabled = false,
  showDescriptions = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBypassWarning, setShowBypassWarning] = useState(false);

  const currentConfig = permissionModes.find(m => m.mode === currentMode) || permissionModes[0];
  const Icon = currentConfig.icon;

  const handleModeSelect = (mode: PermissionMode) => {
    if (mode === PermissionMode.BYPASS && !allowBypass) {
      setShowBypassWarning(true);
      return;
    }
    
    onModeChange(mode);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Selector Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          disabled 
            ? 'opacity-50 cursor-not-allowed bg-muted' 
            : 'hover:bg-muted cursor-pointer'
        } ${currentConfig.bgColor} ${currentConfig.borderColor}`}
      >
        <Icon className={`w-4 h-4 ${currentConfig.color}`} />
        <span className="text-sm font-medium">{currentConfig.label}</span>
        {!disabled && <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            {permissionModes.map((config) => {
              const ModeIcon = config.icon;
              const isDisabled = config.mode === PermissionMode.BYPASS && !allowBypass;
              const isActive = config.mode === currentMode;

              return (
                <button
                  key={config.mode}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleModeSelect(config.mode);
                  }}
                  disabled={isDisabled}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                    isActive 
                      ? `${config.bgColor} ${config.borderColor} border` 
                      : 'hover:bg-muted'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`mt-0.5 ${config.color}`}>
                    <ModeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{config.label}</span>
                      {config.dangerous && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>
                    {showDescriptions && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Footer hint */}
          <div className="px-3 py-2 bg-muted/50 border-t border-border">
            <p className="text-xs text-muted-foreground">
              You can change permission mode anytime during a session
            </p>
          </div>
        </div>
      )}

      {/* Bypass Warning Modal */}
      {showBypassWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[400px] max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Bypass Mode Disabled</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Bypass permission mode is disabled for security reasons. This mode allows 
              Claude to run without any permission prompts, which can be dangerous.
            </p>
            
            <p className="text-sm mb-6">
              To enable bypass mode, go to <strong>Settings → Security</strong> and 
              toggle &quot;Allow bypass permissions mode&quot;.
            </p>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBypassWarning(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionSelector;
