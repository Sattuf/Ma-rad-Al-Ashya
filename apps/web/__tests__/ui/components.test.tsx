import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Alert, Button, EmptyState, Input, ThemeToggle } from '@/components/ui';

describe('design system components', () => {
  it('Input links its label, hint and error for assistive tech', () => {
    const { rerender } = render(<Input label="البريد" hint="نرسل إليه الإيصالات" />);
    const field = screen.getByLabelText('البريد');
    expect(field).toHaveAccessibleDescription('نرسل إليه الإيصالات');
    expect(field).not.toHaveAttribute('aria-invalid');

    rerender(<Input label="البريد" hint="نرسل إليه الإيصالات" error="البريد غير صالح" />);
    expect(screen.getByLabelText('البريد')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('البريد')).toHaveAccessibleDescription('البريد غير صالح');
  });

  it('Button is disabled and busy while loading', () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        حفظ
      </Button>,
    );
    const button = screen.getByRole('button', { name: /حفظ/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Button defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>إلغاء</Button>);
    expect(screen.getByRole('button', { name: 'إلغاء' })).toHaveAttribute('type', 'button');
  });

  it('danger Alert is announced immediately', () => {
    render(<Alert tone="danger">فشل الحفظ</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('فشل الحفظ');
  });

  it('EmptyState renders the next action', () => {
    render(<EmptyState title="لا توجد إعلانات" action={<Button>أضف إعلاناً</Button>} />);
    expect(screen.getByRole('heading', { name: 'لا توجد إعلانات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'أضف إعلاناً' })).toBeInTheDocument();
  });

  it('ThemeToggle switches <html data-theme> and remembers the choice', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الوضع الداكن' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'تفعيل الوضع الفاتح' })).toBeInTheDocument();
  });
});
