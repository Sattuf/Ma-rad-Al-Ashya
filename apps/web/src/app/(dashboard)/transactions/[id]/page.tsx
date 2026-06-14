'use client';

import { useState, use } from 'react';
import { useTransaction } from '@/hooks/useTransactions';
import { transactionsApi } from '@/lib/api/transactions';
import { useAuthStore } from '@/lib/store/auth-store';
import { Check, X, Star, AlertCircle } from 'lucide-react';

const STEPS = [
  { id: 'pending_seller', title: 'تأكيد البائع' },
  { id: 'pending_buyer', title: 'تأكيد المشتري' },
  { id: 'completed', title: 'مكتمل' },
];

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { transaction, isLoading, mutate } = useTransaction(resolvedParams.id);
  const { user } = useAuthStore();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">جاري التحميل...</div>;
  if (!transaction) return <div className="p-8 text-center text-red-500">المعاملة غير موجودة.</div>;

  const isSeller = user?.id === transaction.sellerId;
  const isBuyer = user?.id === transaction.buyerId;

  const currentStepIndex = transaction.status === 'cancelled' 
    ? -1 
    : STEPS.findIndex(s => s.id === transaction.status);

  const canConfirm = 
    (transaction.status === 'pending_seller' && isSeller) ||
    (transaction.status === 'pending_buyer' && isBuyer);

  const canCancel = transaction.status !== 'completed' && transaction.status !== 'cancelled';
  
  const showReviewForm = transaction.status === 'completed' && !transaction.hasReviewed; // Assumes hasReviewed or we can check if they reviewed

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await transactionsApi.confirmTransaction(transaction.id);
      mutate();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء التأكيد');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      await transactionsApi.cancelTransaction(transaction.id);
      mutate();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الإلغاء');
    } finally {
      setIsCancelling(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setReviewError('يرجى اختيار تقييم');
      return;
    }
    try {
      setIsSubmittingReview(true);
      setReviewError('');
      await transactionsApi.createReview(transaction.id, rating, comment);
      mutate();
      // Optionally show a success message
    } catch (error: any) {
      console.error(error);
      setReviewError(error.response?.data?.message || 'حدث خطأ أثناء تقديم التقييم');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">تفاصيل المعاملة</h1>
        <p className="mt-1 text-sm text-gray-500">رقم: {transaction.id}</p>
      </div>

      {/* Stepper */}
      <div className="bg-white p-6 shadow sm:rounded-lg">
        {transaction.status === 'cancelled' ? (
          <div className="text-center text-red-600 font-bold p-4 bg-red-50 rounded-md flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" />
            تم إلغاء هذه المعاملة
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-between">
              {STEPS.map((step, stepIdx) => {
                const isActive = stepIdx === currentStepIndex;
                const isCompleted = stepIdx < currentStepIndex || transaction.status === 'completed';
                return (
                  <div key={step.id} className="flex flex-col items-center bg-white px-2">
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${
                      isCompleted ? 'bg-emerald-600 text-white' : isActive ? 'bg-teal-600 text-white ring-teal-100' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <span>{stepIdx + 1}</span>}
                    </span>
                    <span className={`mt-2 text-sm font-medium ${isActive ? 'text-teal-600' : isCompleted ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex items-center gap-4">
          {transaction.listing?.images?.[0] && (
             <img src={transaction.listing.images[0]} alt="" className="w-16 h-16 rounded object-cover" />
          )}
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">{transaction.listing?.title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">السعر: {transaction.listing?.price} ريال</p>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">البائع</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{transaction.seller?.name}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">المشتري</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{transaction.buyer?.name}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      {(canConfirm || canCancel) && (
        <div className="flex gap-4 items-center justify-end">
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <X className="mr-2 -ml-1 h-5 w-5 text-gray-400" aria-hidden="true" />
              إلغاء المعاملة
            </button>
          )}
          {canConfirm && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <Check className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
              تأكيد المعاملة
            </button>
          )}
        </div>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">تقييم تجربتك</h3>
          <form onSubmit={submitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التقييم</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoveredRating || rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                تعليق (اختياري)
              </label>
              <textarea
                id="comment"
                rows={3}
                className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="كيف كانت تجربتك؟"
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="mt-2 text-sm text-gray-500 text-left" dir="ltr">
                {comment.length} / 500
              </p>
            </div>
            {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
            <button
              type="submit"
              disabled={isSubmittingReview}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 w-full sm:w-auto"
            >
              {isSubmittingReview ? 'جاري الإرسال...' : 'إرسال التقييم'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
