import React, { useEffect, useMemo, useState } from 'react';
import { Skill } from '../../shared/types';
import { Wrench, Plus, FileText, Tag, Trash2, Edit2, Search } from 'lucide-react';
import { AppPageLayout } from './layout/AppPageLayout';

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

  useEffect(() => {
    if (skills.length === 0) {
      setSelectedSkill(null);
      return;
    }

    if (!selectedSkill) {
      setSelectedSkill(skills[0]);
      return;
    }

    const stillExists = skills.some((skill) => skill.id === selectedSkill.id);
    if (!stillExists) {
      setSelectedSkill(skills[0]);
    }
  }, [skills, selectedSkill]);

  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) =>
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [skills, searchQuery]
  );

  const handleCreate = async () => {
    try {
      const payload = {
        ...newSkill,
        name: newSkill.name.trim(),
        description: newSkill.description.trim(),
        content: newSkill.content.trim()
      };

      await onCreateSkill(payload);
      setShowCreateModal(false);
      setNewSkill({ name: '', description: '', content: '' });
    } catch (error) {
      console.error('Failed to create skill:', error);
    }
  };

  return (
    <>
      <AppPageLayout
        title="Skills"
        subtitle="Reusable instructions and templates"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Skill
          </button>
        }
      >
        <div className="page-layout-grid">
          <aside className="col-span-12 lg:col-span-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden min-h-[520px] flex flex-col">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h3 className="text-[13px] font-medium text-[var(--text-primary)]">Library</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Browse and manage installed skills</p>
              <div className="relative mt-3">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--a-500)]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-1">
              {filteredSkills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className={`w-full text-left p-3 rounded-[var(--radius-md)] border transition-all ${
                    selectedSkill?.id === skill.id
                      ? 'bg-[var(--bg-hover)] border-[var(--border-default)]'
                      : 'bg-transparent border-transparent hover:bg-[var(--bg-hover)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="font-medium text-[13px] text-[var(--text-primary)] truncate">{skill.name}</span>
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
                </button>
              ))}

              {filteredSkills.length === 0 && (
                <div className="text-center py-10 text-[var(--text-muted)]">
                  <Wrench className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">No skills found</p>
                </div>
              )}
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-8 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden min-h-[520px] flex flex-col">
            {selectedSkill ? (
              <>
                <div className="p-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-medium text-[var(--text-primary)] truncate">{selectedSkill.name}</h3>
                    <p className="text-[12px] text-[var(--text-muted)] mt-1">{selectedSkill.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedSkill.tags.map(tag => (
                        <span key={tag} className="badge badge-neutral">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-ghost btn-icon-sm"
                      title="Edit skill"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon-sm text-[var(--error)] hover:text-[var(--error)]"
                      title="Delete skill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                  <div>
                    <h4 className="text-[12px] font-medium mb-2 text-[var(--text-secondary)]">Files</h4>
                    <div className="space-y-2">
                      {selectedSkill.files.map(file => (
                        <div
                          key={file.path}
                          className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{file.path}</span>
                            <span className="text-[10px] text-[var(--text-muted)] uppercase">
                              {file.type}
                            </span>
                          </div>
                          <pre className="text-[11px] bg-[var(--bg-app)] p-2 rounded-[var(--radius-sm)] overflow-x-auto border border-[var(--border-faint)]">
                            <code className="text-[var(--text-secondary)]">
                              {file.content.slice(0, 500)}
                              {file.content.length > 500 ? '...' : ''}
                            </code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[12px] font-medium mb-2 text-[var(--text-secondary)]">Configuration</h4>
                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 rounded-[var(--radius-md)] text-[12px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[var(--text-muted)]">Entry Point:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.config.entryPoint || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Version:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.version || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Author:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.author || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Dependencies:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{selectedSkill.config.dependencies.length || 'None'}</span>
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
          </section>
        </div>
      </AppPageLayout>

      {showCreateModal && (
        <div className="fixed inset-0 bg-[rgba(3,7,9,0.8)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 w-[600px] max-w-[90vw]">
            <h2 className="text-[16px] font-medium text-[var(--text-primary)] mb-4">Create New Skill</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Name</label>
                <input
                  type="text"
                  value={newSkill.name}
                  onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--a-500)]"
                  placeholder="My Custom Skill"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Description</label>
                <textarea
                  value={newSkill.description}
                  onChange={e => setNewSkill({ ...newSkill, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] h-20 resize-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--a-500)]"
                  placeholder="What does this skill do?"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Content</label>
                <textarea
                  value={newSkill.content}
                  onChange={e => setNewSkill({ ...newSkill, content: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] h-40 resize-none font-[var(--font-mono)] text-[12px] text-[var(--text-secondary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--a-500)]"
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
                disabled={!newSkill.name.trim() || !newSkill.content.trim()}
                className="btn btn-primary disabled:opacity-50"
              >
                Create Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

