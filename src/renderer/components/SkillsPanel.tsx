import React, { useState } from 'react';
import { Skill } from '../shared/types';
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
      {/* Skills List */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Skills Library</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
          />
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-2">
          {filteredSkills.map(skill => (
            <div
              key={skill.id}
              onClick={() => setSelectedSkill(skill)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedSkill?.id === skill.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{skill.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {skill.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {skill.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {filteredSkills.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No skills found</p>
            </div>
          )}
        </div>
      </div>

      {/* Skill Detail */}
      <div className="flex-1 flex flex-col">
        {selectedSkill ? (
          <>
            <div className="p-4 border-b border-border flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedSkill.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedSkill.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkill.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-muted rounded-full text-xs">
                      <Tag className="w-3 h-3 inline mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-muted rounded-md">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-destructive hover:bg-destructive/10 rounded-md">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Files</h3>
                  <div className="space-y-2">
                    {selectedSkill.files.map(file => (
                      <div
                        key={file.path}
                        className="p-3 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{file.path}</span>
                          <span className="text-xs text-muted-foreground uppercase">
                            {file.type}
                          </span>
                        </div>
                        <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                          <code>{file.content.slice(0, 500)}{file.content.length > 500 ? '...' : ''}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Configuration</h3>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Entry Point:</span>
                        <span className="ml-2">{selectedSkill.config.entryPoint}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Version:</span>
                        <span className="ml-2">{selectedSkill.version}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Author:</span>
                        <span className="ml-2">{selectedSkill.author}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dependencies:</span>
                        <span className="ml-2">{selectedSkill.config.dependencies.length || 'None'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Select a skill to view details</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[600px]">
            <h2 className="text-lg font-semibold mb-4">Create New Skill</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newSkill.name}
                  onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="My Custom Skill"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newSkill.description}
                  onChange={e => setNewSkill({ ...newSkill, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md h-20 resize-none"
                  placeholder="What does this skill do?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={newSkill.content}
                  onChange={e => setNewSkill({ ...newSkill, content: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md h-40 resize-none font-mono text-sm"
                  placeholder="Enter skill instructions..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newSkill.name || !newSkill.content}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
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