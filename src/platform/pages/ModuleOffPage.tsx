import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Blocks } from 'lucide-react';
import { EmptyState } from '../ui';
import { MODULES } from '../modules';
import { WORKSPACE_LABEL, currentWorkspace } from '../workspace';

export const ModuleOffPage: React.FC = () => {
  const { pathname } = useLocation();
  const owner = MODULES.find((m) => m.paths.some((p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`))));
  const notForIndustry = owner?.industries?.length && !owner.industries.includes(currentWorkspace());
  return (
    <div className="g2 g2-embed" style={{ paddingTop: 40 }}>
      {notForIndustry
        ? <EmptyState icon={<Blocks size={28} />} title={`${owner!.name} is not part of your workspace`} description={`It is built for ${owner!.industries!.map((i) => WORKSPACE_LABEL[i]).join(', ')}.`} action={<Link to="/">Back to Product Master</Link>} />
        : <EmptyState icon={<Blocks size={28} />} title="This module is switched off" description="Switch it on in Modules to use this screen." action={<Link to="/modules">Open Modules</Link>} />}
    </div>
  );
};
