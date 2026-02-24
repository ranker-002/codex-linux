import React, { useState } from 'react';
import { Skill } from '../../shared/types';
import { Wrench, Plus, FileText, Tag, Trash2, Edit2 } from 'lucide-react';

interface SkillsPanelProps {
  skills: Skill[];
  onCreateSkill: (config: any) => Promise<Skill>;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  skills,
  onCreateSkill
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newSkill, setNewSkill] = useState({
    name: '',
    description: '',
    content: ''
  });

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreate = async () => {
    try {
      await onCreateSkill(newSkill);
      setShowCreateModal(false);
      setNewSkill({ name: '', description: '', content: '' });
    } catch (error) {
      console.error('Failed to create skill:', error);
    }
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-faint)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-[13px] text-[var(--text-primary)]">Skills Library</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
          />
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {filteredSkills.map(skill => (
            <div
              key={skill.id}
              onClick={() => setSelectedSkill(skill)}
              className={`p-3 rounded-[var(--radius-md)] cursor-pointer transition-all ${
                selectedSkill?.id === skill.id
                  ? 'bg-[rgba(0,200,168,0.08)] border border-[var(--border-accent)]'
                  : 'hover:bg-[var(--bg-hover)] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="font-medium text-[13px] text-[var(--text-primary)]">{skill.name}</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-2">
                {skill.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {skill.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="badge badge-neutral text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {filteredSkills.length === 0 && (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Wrench className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">No skills found</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedSkill ? (
          <>
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-start justify-between">
              <div>
                <h2 className="text-[16px] font-medium text-[var(--text-primary)]">{selectedSkill.name}</h2>
                <p className="text-[12px] text-[var(--text-muted)]">{selectedSkill.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkill.tags.map(tag => (
                    <span key={tag} className="badge badge-teal">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-[var(--error)] hover:bg-[rgba(232,90,106,0.1)] rounded-[var(--radius-sm)] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-[12px] font-medium mb-2 text-[var(--text-secondary)]">Files</h3>
                  <div className="space-y-2">
                    {selectedSkill.files.map(file => (
                      <div
                        key={file.path}
                        className="p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-[12px] font-medium text-[var(--text-primary)]">{file.path}</span>
                          <span className="text-[10px] text-[var(--text-muted)] uppercase">
                            {file.type}
                          </span>
                        </div>
                        <pre className="text-[11px] bg-[var(--bg-void)] p-2 rounded-[var(--radius-sm)] overflow-x-auto border border-[var(--border-faint)]">
                          <code className="text-[var(--teal-300)]">{file.content.slice(0, 500)}{file.content.length > 500 ? '...' : ''}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[12px] font-medium mb-2 text-[var(--text-secondary)]">Configuration</h3>
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-[var(--radius-md)] text-[12px]">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[var(--text-muted)]">Entry Point:</span>
                        <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.config.entryPoint}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Version:</span>
                        <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.version}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Author:</span>
                        <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.author}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Dependencies:</span>
                        <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.config.dependencies.length || 'None'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-[14px]">Select a skill to view details</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-[rgba(3,7,9,0.8)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 w-[600px]">
            <h2 className="text-[16px] font-medium text-[var(--text-primary)] mb-4">Create New Skill</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Name</label>
                <input
                  type="text"
                  value={newSkill.name}
                  onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="My Custom Skill"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Description</label>
                <textarea
                  value={newSkill.description}
                  onChange={e => setNewSkill({ ...newSkill, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] h-20 resize-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="What does this skill do?"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Content</label>
                <textarea
                  value={newSkill.content}
                  onChange={e => setNewSkill({ ...newSkill, content: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] h-40 resize-none font-[var(--font-mono)] text-[12px] text-[var(--teal-300)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="Enter skill instructions..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newSkill.name || !newSkill.content}
                className="px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] disabled:opacity-50 text-[13px] font-medium transition-colors hover:bg-[var(--teal-400)]"
              >
                Create Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
