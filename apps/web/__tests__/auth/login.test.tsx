import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

// Mock the useRouter hook
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return {
      get: jest.fn(),
    };
  },
}));

describe('LoginPage', () => {
  it('renders login form correctly', () => {
    render(<LoginPage />);
    
    // Check for the heading
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    
    // Check for the inputs (by label)
    expect(screen.getByLabelText('البريد الإلكتروني أو رقم الهاتف')).toBeInTheDocument();
    expect(screen.getByLabelText('كلمة المرور')).toBeInTheDocument();
    
    // Check for buttons
    expect(screen.getByRole('button', { name: /تسجيل الدخول/i })).toBeInTheDocument();
    expect(screen.getByText('جوجل')).toBeInTheDocument();
    expect(screen.getByText('فيسبوك')).toBeInTheDocument();
  });
});
