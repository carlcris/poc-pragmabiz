export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground p-12 flex-col justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-4">ERP System</h1>
          <p className="text-lg opacity-90">
            Sales & Inventory Management Solution
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary-foreground rounded-full mt-2" />
            <div>
              <h3 className="font-semibold mb-1">Streamline Operations</h3>
              <p className="text-sm opacity-80">
                Manage your sales, inventory, and warehouse operations in one
                place
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary-foreground rounded-full mt-2" />
            <div>
              <h3 className="font-semibold mb-1">Real-time Insights</h3>
              <p className="text-sm opacity-80">
                Get instant access to critical business data and analytics
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary-foreground rounded-full mt-2" />
            <div>
              <h3 className="font-semibold mb-1">Multi-language Support</h3>
              <p className="text-sm opacity-80">
                Work in your preferred language with full localization support
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
