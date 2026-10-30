'use client';
import MasterManager from '../../../components/ui/MasterManager';

export default function SizesPage() {
  return <MasterManager title="Sizes" singular="Size" basePath="/api/sizes" hasSortOrder />;
}
