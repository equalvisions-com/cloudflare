import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'User profile page',
};

export default function ProfilePage() {
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-semibold">Hi!</h1>
    </div>
  );
}
