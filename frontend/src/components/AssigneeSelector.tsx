import React from 'react';
import { User } from '../types';

interface AssigneeSelectorProps {
  members: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function AssigneeSelector({ members, selectedIds, onChange }: AssigneeSelectorProps) {
  const allSelected = members.length > 0 && members.every((member) => selectedIds.includes(member.id));
  const toggleMember = (userId: string) => onChange(
    selectedIds.includes(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId]
  );

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <label style={{ margin: 0 }}>Caktoju anëtarëve</label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(allSelected ? [] : members.map((member) => member.id))}>
          {allSelected ? 'Hiq të gjithë' : 'Zgjidh të gjithë'}
        </button>
      </div>
      <p style={{ margin: '5px 0 10px', color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>
        Zgjidh një, disa ose të gjithë anëtarët e hapësirës.
      </p>
      <div className="assignee-selector" role="group" aria-label="Anëtarët e caktuar">
        {members.map((member) => (
          <label key={member.id} className="assignee-option">
            <input type="checkbox" checked={selectedIds.includes(member.id)} onChange={() => toggleMember(member.id)} />
            <span>{member.firstName} {member.lastName}</span>
            <small>{member.email}</small>
          </label>
        ))}
      </div>
      {selectedIds.length === 0 && <span style={{ color: 'hsl(var(--accent-danger))', fontSize: '0.78rem' }}>Zgjidh së paku një anëtar.</span>}
    </div>
  );
}
