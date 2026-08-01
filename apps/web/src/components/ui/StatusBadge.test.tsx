import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the supplied label', () => {
    render(<StatusBadge label="نشط" tone="success" />);
    expect(screen.getByText('نشط')).toBeInTheDocument();
  });
});
