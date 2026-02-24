import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("allowed_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim()) return;

    try {
      setIsAdding(true);
      const { error } = await supabase
        .from("allowed_users")
        .insert({ email: newEmail.trim().toLowerCase() });

      if (error) throw error;
      
      toast.success(`Added ${newEmail}`);
      setNewEmail("");
      fetchUsers();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error("Failed to add user");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    try {
      const { error } = await supabase
        .from("allowed_users")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success(`Removed ${email}`);
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Failed to remove user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users who have access to the system
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter email to add..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="min-w-[250px]"
            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
          />
          <Button onClick={handleAddUser} disabled={isAdding || !newEmail.trim()}>
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add User
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Authorized Users ({users.length})</CardTitle>
            <CardDescription>
              List of users with access to the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found. Add one above to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-medium">{user.email}</span>
                      {user.email.endsWith("@ponix.co.th") && (
                        <Badge variant="secondary">Company</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}