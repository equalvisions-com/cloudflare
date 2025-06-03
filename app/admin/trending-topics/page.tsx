'use client';

import { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Edit, Plus, Save, X } from 'lucide-react';
import Image from 'next/image';

interface TrendingTopic {
  _id: string;
  title: string;
  subtopic: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

interface EditingTopic {
  _id?: string;
  title: string;
  subtopic: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

export default function TrendingTopicsAdminPage() {
  const { toast } = useToast();
  const [editingTopic, setEditingTopic] = useState<EditingTopic | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Queries
  const trendingTopics = useQuery(api.trendingTopics.getAllTrendingTopics);

  // Mutations
  const createTopic = useMutation(api.trendingTopics.createTrendingTopic);
  const updateTopic = useMutation(api.trendingTopics.updateTrendingTopic);
  const deleteTopic = useMutation(api.trendingTopics.deleteTrendingTopic);
  const seedTopics = useMutation(api.trendingTopics.seedTrendingTopics);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingTopic({
      title: '',
      subtopic: '',
      imageUrl: '',
      isActive: true,
      sortOrder: (trendingTopics?.length || 0),
    });
  };

  const handleEdit = (topic: any) => {
    setIsCreating(false);
    setEditingTopic({
      _id: topic._id,
      title: topic.title,
      subtopic: topic.subtopic,
      imageUrl: topic.imageUrl,
      isActive: topic.isActive,
      sortOrder: topic.sortOrder,
    });
  };

  const handleSave = async () => {
    if (!editingTopic) return;

    try {
      if (isCreating) {
        await createTopic({
          title: editingTopic.title,
          subtopic: editingTopic.subtopic,
          imageUrl: editingTopic.imageUrl,
          isActive: editingTopic.isActive,
          sortOrder: editingTopic.sortOrder,
        });
        toast({
          title: "Success",
          description: "Trending topic created successfully",
        });
      } else if (editingTopic._id) {
        await updateTopic({
          id: editingTopic._id as any,
          title: editingTopic.title,
          subtopic: editingTopic.subtopic,
          imageUrl: editingTopic.imageUrl,
          isActive: editingTopic.isActive,
          sortOrder: editingTopic.sortOrder,
        });
        toast({
          title: "Success",
          description: "Trending topic updated successfully",
        });
      }
      setEditingTopic(null);
      setIsCreating(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save trending topic",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trending topic?')) return;

    try {
      await deleteTopic({ id: id as any });
      toast({
        title: "Success",
        description: "Trending topic deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete trending topic",
        variant: "destructive",
      });
    }
  };

  const handleSeedTopics = async () => {
    if (!confirm('This will create initial trending topics. Continue?')) return;

    try {
      await seedTopics({});
      toast({
        title: "Success",
        description: "Initial trending topics created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to seed trending topics. They may already exist.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingTopic(null);
    setIsCreating(false);
  };

  if (trendingTopics === undefined) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading trending topics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Trending Topics Admin</h1>
        <div className="flex gap-2">
          {(!trendingTopics || trendingTopics.length === 0) && (
            <Button onClick={handleSeedTopics} variant="outline">
              Seed Initial Topics
            </Button>
          )}
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Topic
          </Button>
        </div>
      </div>

      {editingTopic && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{isCreating ? 'Create New Topic' : 'Edit Topic'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editingTopic.title}
                  onChange={(e) => setEditingTopic({ ...editingTopic, title: e.target.value })}
                  placeholder="e.g., Sports, Technology"
                />
              </div>
              <div>
                <Label htmlFor="subtopic">Subtopic</Label>
                <Input
                  id="subtopic"
                  value={editingTopic.subtopic}
                  onChange={(e) => setEditingTopic({ ...editingTopic, subtopic: e.target.value })}
                  placeholder="e.g., NFL Free Agency, AI"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={editingTopic.imageUrl}
                onChange={(e) => setEditingTopic({ ...editingTopic, imageUrl: e.target.value })}
                placeholder="https://example.com/icon.png"
              />
              {editingTopic.imageUrl && (
                <div className="mt-2">
                  <Image
                    src={editingTopic.imageUrl}
                    alt="Preview"
                    width={32}
                    height={32}
                    className="rounded border"
                    onError={() => toast({
                      title: "Invalid Image",
                      description: "The image URL is not valid",
                      variant: "destructive",
                    })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={editingTopic.sortOrder}
                  onChange={(e) => setEditingTopic({ ...editingTopic, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingTopic.isActive}
                  onChange={(e) => setEditingTopic({ ...editingTopic, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleCancel} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {trendingTopics && trendingTopics.length > 0 ? (
          trendingTopics.map((topic) => (
            <Card key={topic._id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {topic.imageUrl && (
                      <Image
                        src={topic.imageUrl}
                        alt={topic.title}
                        width={32}
                        height={32}
                        className="rounded border"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">{topic.title}</h3>
                      <p className="text-sm text-muted-foreground">{topic.subtopic}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                          Order: {topic.sortOrder}
                        </span>
                        {topic.isActive && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(topic)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(topic._id)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No trending topics found.</p>
              <Button onClick={handleSeedTopics} variant="outline">
                Create Initial Topics
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 