import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

it('shows field errors when submitting an empty form', async () => {
  render(<LoginPage />);
  fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
  expect(await screen.findByText('مطلوب إدخال البريد الإلكتروني أو رقم الهاتف')).toBeInTheDocument();
  expect(screen.getByLabelText('البريد الإلكتروني أو رقم الهاتف')).toHaveAttribute('aria-invalid', 'true');
});
