import React from 'react';
import { Link } from 'react-router-dom';
import { Blocks } from 'lucide-react';
import { EmptyState } from '../ui';

export const ModuleOffPage: React.FC = () => (
  <div className="g2 g2-embed" style={{ paddingTop: 40 }}>
    <EmptyState icon={<Blocks size={28} />} title="This module is switched off" description="Switch it on in Modules to use this screen." action={<Link to="/modules">Open Modules</Link>} />
  </div>
);
